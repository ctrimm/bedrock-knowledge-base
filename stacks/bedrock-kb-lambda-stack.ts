import * as aws from "@pulumi/aws";

export const kbDocumentsBucket = new sst.aws.Bucket("bedrock-kb-documents");

// Aurora PostgreSQL Serverless v2 for vector storage
const auroraSubnetGroup = new aws.rds.SubnetGroup("aurora-subnet-group", {
  subnetIds: $aws.ec2.getSubnets({
    filters: [{ name: "default-for-az", values: ["true"] }]
  }).then(subnets => subnets.ids),
  tags: {
    Name: "Aurora subnet group for Bedrock KB",
  },
});

const auroraSecurityGroup = new aws.ec2.SecurityGroup("aurora-security-group", {
  description: "Security group for Aurora PostgreSQL cluster",
  vpcId: $aws.ec2.getVpc({ default: true }).then(vpc => vpc.id),
  ingress: [
    {
      fromPort: 5432,
      toPort: 5432,
      protocol: "tcp",
      cidrBlocks: ["10.0.0.0/8"],
    },
  ],
  egress: [
    {
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
});

export const auroraCluster = new aws.rds.Cluster("bedrock-kb-aurora", {
  engine: "aurora-postgresql",
  engineVersion: "15.4",
  engineMode: "provisioned",
  serverlessv2ScalingConfiguration: {
    maxCapacity: 4,
    minCapacity: 0.5,
  },
  databaseName: "bedrock_kb",
  masterUsername: "postgres",
  manageMasterUserPassword: true,
  skipFinalSnapshot: true,
  dbSubnetGroupName: auroraSubnetGroup.name,
  vpcSecurityGroupIds: [auroraSecurityGroup.id],
});

new aws.rds.ClusterInstance("bedrock-kb-aurora-instance", {
  clusterIdentifier: auroraCluster.id,
  instanceClass: "db.serverless",
  engine: auroraCluster.engine,
  engineVersion: auroraCluster.engineVersion,
});

const bedrockKbRole = new aws.iam.Role("bedrock-kb-role", {
  name: `AmazonBedrockExecutionRoleForKnowledgeBase_bkb-${$app.stage}`,
  description: "IAM role to create a Bedrock Knowledge Base",
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "bedrock.amazonaws.com",
        },
        Action: "sts:AssumeRole",
        Condition: {
          StringEquals: {
            "aws:SourceAccount": $aws.getCallerIdentity({}).then(id => id.accountId),
          },
          ArnLike: {
            "aws:SourceArn": $aws.getCallerIdentity({}).then(id => `arn:aws:bedrock:us-east-1:${id.accountId}:knowledge-base/*`),
          },
        },
      },
    ],
  }),
});

new aws.iam.RolePolicyAttachment("bedrock-kb-invoke-policy", {
  role: bedrockKbRole.name,
  policyArn: new aws.iam.Policy("bedrock-kb-invoke", {
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["bedrock:InvokeModel"],
          Resource: ["arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1"],
        },
      ],
    }),
  }).arn,
});

new aws.iam.RolePolicyAttachment("bedrock-kb-s3-policy", {
  role: bedrockKbRole.name,
  policyArn: new aws.iam.Policy("bedrock-kb-s3-managed-policy", {
    policy: kbDocumentsBucket.arn.apply(bucketArn => JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "S3ListBucketStatement",
          Effect: "Allow",
          Action: ["s3:ListBucket"],
          Resource: [bucketArn],
          Condition: {
            StringEquals: {
              "aws:ResourceAccount": $aws.getCallerIdentity({}).then(id => id.accountId),
            },
          },
        },
        {
          Sid: "S3GetObjectStatement",
          Effect: "Allow",
          Action: ["s3:GetObject"],
          Resource: [`${bucketArn}/*`],
          Condition: {
            StringEquals: {
              "aws:ResourceAccount": $aws.getCallerIdentity({}).then(id => id.accountId),
            },
          },
        },
      ],
    })),
  }).arn,
});

new aws.iam.RolePolicyAttachment("bedrock-kb-rds-policy", {
  role: bedrockKbRole.name,
  policyArn: new aws.iam.Policy("bedrock-kb-rds", {
    policy: auroraCluster.arn.apply(clusterArn => JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "rds-data:BatchExecuteStatement",
            "rds-data:BeginTransaction",
            "rds-data:CommitTransaction",
            "rds-data:ExecuteStatement",
            "rds-data:RollbackTransaction",
          ],
          Resource: [clusterArn],
        },
      ],
    })),
  }).arn,
});

export const promptFunction = new sst.aws.Function("prompt", {
  handler: "packages/functions/src/prompt/lambda.handler",
  runtime: "nodejs20.x",
  timeout: "1 minute",
  environment: {
    KNOWLEDGE_BASE_ID: process.env.KNOWLEDGE_BASE_ID || "placeholder-kb-id",
  },
  url: true,
});

new aws.iam.RolePolicyAttachment("prompt-function-bedrock-policy", {
  role: promptFunction.nodes.function.role?.name!,
  policyArn: new aws.iam.Policy("prompt-function-bedrock", {
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "bedrock:RetrieveAndGenerate",
            "bedrock:Retrieve",
            "bedrock:InvokeModel",
          ],
          Resource: "*",
        },
      ],
    }),
  }).arn,
});

export const syncKnowledgeBaseFunction = new sst.aws.Function("sync-kb", {
  handler: "packages/functions/src/sync-kb/lambda.handler",
  runtime: "nodejs20.x",
  environment: {
    KNOWLEDGE_BASE_ID: process.env.KNOWLEDGE_BASE_ID || "placeholder-kb-id",
    DATA_SOURCE_ID: process.env.DATA_SOURCE_ID || "placeholder-data-source-id",
  },
});

new aws.iam.RolePolicyAttachment("sync-function-bedrock-policy", {
  role: syncKnowledgeBaseFunction.nodes.function.role?.name!,
  policyArn: new aws.iam.Policy("sync-function-bedrock", {
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "bedrock:StartIngestionJob",
            "bedrock:AssociateThirdPartyKnowledgeBase",
          ],
          Resource: "*",
        },
      ],
    }),
  }).arn,
});

new aws.s3.BucketNotification("kb-bucket-notification", {
  bucket: kbDocumentsBucket.name,
  lambdaFunctions: [
    {
      lambdaFunctionArn: syncKnowledgeBaseFunction.arn,
      events: ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"],
    },
  ],
});

new aws.lambda.Permission("allow-s3-invoke-sync", {
  statementId: "AllowS3Invoke",
  action: "lambda:InvokeFunction",
  function: syncKnowledgeBaseFunction.name,
  principal: "s3.amazonaws.com",
  sourceArn: kbDocumentsBucket.arn,
});

export const web = new sst.aws.Nextjs("web", {
  path: "packages/web",
  environment: {
    NEXT_PUBLIC_PROMPT_URL: promptFunction.url,
  },
});

export const outputs = {
  promptUrl: promptFunction.url,
  webUrl: web.url,
};