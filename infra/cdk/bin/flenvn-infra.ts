#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FlenvnEc2Stack } from '../lib/flenvn-ec2-stack';

const app = new cdk.App();

new FlenvnEc2Stack(app, 'FlenvnEc2Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
