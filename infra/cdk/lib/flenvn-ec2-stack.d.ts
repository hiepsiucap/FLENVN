import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class FlenvnEc2Stack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps);
    private readSettings;
    private contextString;
    private contextNumber;
    private contextBoolean;
    private instanceClass;
    private instanceSize;
}
