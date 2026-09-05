import * as cdk from 'aws-cdk-lib';
import { Annotations, CfnOutput, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface StackSettings {
  projectName: string;
  envName: string;
  instanceClass: string;
  instanceSize: string;
  keyName?: string;
  sshCidr: string;
  volumeSizeGiB: number;
  allowHttp: boolean;
  allowHttps: boolean;
  useSpot: boolean;
  spotMaxPrice: string;
}

export class FlenvnEc2Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const settings = this.readSettings();
    const namePrefix = `${settings.projectName}-${settings.envName}`;

    if (settings.sshCidr === '0.0.0.0/0') {
      Annotations.of(this).addWarning(
        'SSH is open to the internet. For production, deploy with -c sshCidr=<your-ip>/32.',
      );
    }

    if (settings.useSpot) {
      throw new Error(
        'Spot mode is not enabled in this stack yet. Deploy On-Demand with useSpot=false, or add Launch Template Spot support first.',
      );
    }

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${namePrefix}-vpc`,
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
      vpc,
      securityGroupName: `${namePrefix}-ec2-sg`,
      description: 'FLENVN EC2 security group',
      allowAllOutbound: true,
    });

    const labelingDeadLetterQueue = new sqs.Queue(
      this,
      'VocabularyLabelingDeadLetterQueue',
      {
        queueName: `${namePrefix}-vocabulary-labeling-dlq`,
        retentionPeriod: cdk.Duration.days(14),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
      },
    );

    const labelingQueue = new sqs.Queue(this, 'VocabularyLabelingQueue', {
      queueName: `${namePrefix}-vocabulary-labeling`,
      visibilityTimeout: cdk.Duration.seconds(60),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: labelingDeadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    securityGroup.addIngressRule(
      ec2.Peer.ipv4(settings.sshCidr),
      ec2.Port.tcp(22),
      'SSH access',
    );

    if (settings.allowHttp) {
      securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(80),
        'HTTP access',
      );
    }

    if (settings.allowHttps) {
      securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(443),
        'HTTPS access',
      );
    }

    const role = new iam.Role(this, 'InstanceRole', {
      roleName: `${namePrefix}-ec2-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore',
        ),
      ],
    });

    const instanceProfile = new iam.CfnInstanceProfile(
      this,
      'InstanceProfile',
      {
        instanceProfileName: `${namePrefix}-ec2-profile`,
        roles: [role.roleName],
      },
    );

    labelingQueue.grantSendMessages(role);
    labelingQueue.grantConsumeMessages(role);

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      'dnf update -y',
      'dnf install -y docker git',
      'systemctl enable --now docker',
      'mkdir -p /opt/flenvn/postgres-data /opt/flenvn/backups',
      "cat >/opt/flenvn/docker-compose.yml <<'COMPOSE'",
      'services:',
      '  postgres:',
      '    image: postgres:15',
      '    container_name: flenvn-postgres',
      '    restart: unless-stopped',
      '    environment:',
      '      POSTGRES_USER: flenvn_user',
      '      POSTGRES_PASSWORD: change-me-before-use',
      '      POSTGRES_DB: flenvn_db',
      '    ports:',
      '      - "127.0.0.1:5432:5432"',
      '    volumes:',
      '      - ./postgres-data:/var/lib/postgresql/data',
      'COMPOSE',
      'chown -R ec2-user:ec2-user /opt/flenvn',
    );

    const machineImage =
      ec2.MachineImage.latestAmazonLinux2023().getImage(this);

    const instance = new ec2.CfnInstance(this, 'Instance', {
      imageId: machineImage.imageId,
      instanceType: `${settings.instanceClass}.${settings.instanceSize}`,
      iamInstanceProfile: instanceProfile.ref,
      keyName: settings.keyName,
      securityGroupIds: [securityGroup.securityGroupId],
      subnetId: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC })
        .subnetIds[0],
      userData: cdk.Fn.base64(userData.render()),
      blockDeviceMappings: [
        {
          deviceName: '/dev/xvda',
          ebs: {
            encrypted: true,
            volumeSize: settings.volumeSizeGiB,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          },
        },
      ],
      tags: [
        {
          key: 'Name',
          value: `${namePrefix}-api-db`,
        },
      ],
    });

    instance.addPropertyOverride(
      'BlockDeviceMappings.0.Ebs.DeleteOnTermination',
      true,
    );

    const rootVolumePolicy = settings.useSpot
      ? 'kept when the Spot instance is interrupted or removed'
      : 'deleted when the instance is destroyed';

    Annotations.of(this).addInfo(
      `Root EBS volume is ${rootVolumePolicy}. Use regular pg_dump backups either way.`,
    );

    // Keep this small map-based validation near the template edge. CfnInstance
    // accepts any valid EC2 type string, while these enum lookups catch typos.
    this.instanceClass(settings.instanceClass);
    this.instanceSize(settings.instanceSize);

    const elasticIp = new ec2.CfnEIP(this, 'ElasticIp', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: `${namePrefix}-eip` }],
    });

    new ec2.CfnEIPAssociation(this, 'ElasticIpAssociation', {
      allocationId: elasticIp.attrAllocationId,
      instanceId: instance.ref,
    });

    Tags.of(this).add('Project', settings.projectName);
    Tags.of(this).add('Environment', settings.envName);

    new CfnOutput(this, 'PublicIp', {
      value: elasticIp.ref,
      description: 'Elastic public IP for the EC2 instance',
    });

    new CfnOutput(this, 'VocabularyLabelingQueueUrl', {
      value: labelingQueue.queueUrl,
      description: 'Set this value as AUTO_LABELING_QUEUE_URL',
    });

    new CfnOutput(this, 'VocabularyLabelingDeadLetterQueueUrl', {
      value: labelingDeadLetterQueue.queueUrl,
    });

    new CfnOutput(this, 'SshCommand', {
      value: settings.keyName
        ? `ssh -i <path-to-${settings.keyName}.pem> ec2-user@${elasticIp.ref}`
        : `ssh ec2-user@${elasticIp.ref}`,
      description: 'SSH command template',
    });

    new CfnOutput(this, 'PostgresNote', {
      value:
        'Postgres is bound to 127.0.0.1:5432 on the EC2 instance, not exposed publicly.',
    });
  }

  private readSettings(): StackSettings {
    return {
      projectName: this.contextString('projectName', 'flenvn'),
      envName: this.contextString('envName', 'prod'),
      instanceClass: this.contextString('instanceClass', 't2'),
      instanceSize: this.contextString('instanceSize', 'micro'),
      keyName: this.node.tryGetContext('keyName'),
      sshCidr: this.contextString('sshCidr', '0.0.0.0/0'),
      volumeSizeGiB: this.contextNumber('volumeSizeGiB', 30),
      allowHttp: this.contextBoolean('allowHttp', true),
      allowHttps: this.contextBoolean('allowHttps', true),
      useSpot: this.contextBoolean('useSpot', false),
      spotMaxPrice: this.contextString('spotMaxPrice', '0.012'),
    };
  }

  private contextString(name: string, defaultValue: string): string {
    const value = this.node.tryGetContext(name);
    return value === undefined ? defaultValue : String(value);
  }

  private contextNumber(name: string, defaultValue: number): number {
    const value = this.node.tryGetContext(name);
    if (value === undefined) {
      return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Context value "${name}" must be a number.`);
    }

    return parsed;
  }

  private contextBoolean(name: string, defaultValue: boolean): boolean {
    const value = this.node.tryGetContext(name);
    if (value === undefined) {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    throw new Error(`Context value "${name}" must be true or false.`);
  }

  private instanceClass(value: string): ec2.InstanceClass {
    const normalized = value.toUpperCase().replaceAll('-', '_');
    const instanceClass =
      ec2.InstanceClass[normalized as keyof typeof ec2.InstanceClass];

    if (!instanceClass) {
      throw new Error(`Unsupported EC2 instance class: ${value}`);
    }

    return instanceClass;
  }

  private instanceSize(value: string): ec2.InstanceSize {
    const normalized = value.toUpperCase().replaceAll('-', '_');
    const instanceSize =
      ec2.InstanceSize[normalized as keyof typeof ec2.InstanceSize];

    if (!instanceSize) {
      throw new Error(`Unsupported EC2 instance size: ${value}`);
    }

    return instanceSize;
  }
}
