import { StackContext, Function, Bucket, StaticSite } from "sst/constructs";
import { BedrockKnowledgeBase } from "bedrock-agents-cdk";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { SecretValue } from "aws-cdk-lib";

function getPyBundlePath(name: string) {
  return `py-bundles/${name}-py-bundle`;
}

export function BedrockKbLambdaStack({ stack }: StackContext) {
  const kbDocumentsBucket = new Bucket(stack, "bedrock-kb-documents");

  const apiKeyPineconeSecret = new secretsmanager.Secret(
    stack,
    "api-key-pinecone-secret",
    {
      secretObjectValue: {
        apiKey: SecretValue.unsafePlainText(process.env.PINECONE_API_KEY ?? ""),
      },
    }
  );

  const bedrockKbRole = new iam.Role(stack, "bedrock-kb-role", {
    roleName: `AmazonBedrockExecutionRoleForKnowledgeBase_bkb-${stack.stage}`,
    description: "IAM role to create a Bedrock Knowledge Base",
    assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com", {
      conditions: {
        ["StringEquals"]: {
          "aws:SourceAccount": stack.account,
        },
        ["ArnLike"]: {
          "aws:SourceArn": `arn:aws:bedrock:us-east-1:${stack.account}:knowledge-base/*`,
        },
      },
    }),
    managedPolicies: [
      new iam.ManagedPolicy(stack, "bedrock-kb-invoke", {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["bedrock:InvokeModel"],
            resources: [
              "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1",
            ],
          }),
        ],
      }),
      new iam.ManagedPolicy(stack, "bedrock-kb-s3-managed-policy", {
        statements: [
          new iam.PolicyStatement({
            sid: "S3ListBucketStatement",
            effect: iam.Effect.ALLOW,
            actions: ["s3:ListBucket"],
            resources: [kbDocumentsBucket.bucketArn],
            conditions: {
              ["StringEquals"]: {
                "aws:ResourceAccount": stack.account,
              },
            },
          }),
          new iam.PolicyStatement({
            sid: "S3GetObjectStatement",
            effect: iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${kbDocumentsBucket.bucketArn}/*`],
            conditions: {
              ["StringEquals"]: {
                "aws:ResourceAccount": stack.account,
              },
            },
          }),
        ],
      }),
      new iam.ManagedPolicy(stack, "bedrock-kb-secret-manager", {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: [apiKeyPineconeSecret.secretArn],
          }),
        ],
      }),
    ],
  });

  const bedrockKb = new BedrockKnowledgeBase(stack, "bedrock-knowledge-base", {
    name: `bedrock-kb-${stack.stage}`,
    roleArn: bedrockKbRole.roleArn,
    storageConfiguration: {
      pineconeConfiguration: {
        connectionString: process.env.PINECONE_CONNECTION_STRING ?? "",
        credentialsSecretArn: apiKeyPineconeSecret.secretArn,
        fieldMapping: {
          metadataField: "metadata",
          textField: "text",
        },
      },
      type: "PINECONE",
    },
    dataSource: {
      dataSourceConfiguration: {
        s3Configuration: {
          bucketArn: kbDocumentsBucket.bucketArn,
        },
      },
    },
  });

  const promptFunction = new Function(stack, "prompt", {
    runtime: "python3.12",
    handler: "packages/functions/src/prompt/lambda.handler",
    python: {
      noDocker: true,
    },
    copyFiles: [{ from: getPyBundlePath("prompt"), to: "./" }],
    url: true,
    timeout: "1 minute",
    environment: {
      KNOWLEDGE_BASE_ID: bedrockKb.knowledgeBaseId,
    },
  });
  promptFunction.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:RetrieveAndGenerate",
        "bedrock:Retrieve",
        "bedrock:InvokeModel",
      ],
      resources: ["*"], // TODO: Use only the recently created knowledge base arn
    })
  );

  const syncKnowledgeBaseFunction = new Function(stack, "sync-kb", {
    runtime: "python3.12",
    handler: "packages/functions/src/sync-kb/lambda.handler",
    python: {
      noDocker: true,
    },
    copyFiles: [{ from: getPyBundlePath("sync-kb"), to: "./" }],
    environment: {
      KNOWLEDGE_BASE_ID: bedrockKb.knowledgeBaseId,
      DATA_SOURCE_ID: bedrockKb.dataSourceId,
    },
  });
  syncKnowledgeBaseFunction.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:StartIngestionJob",
        "bedrock:AssociateThirdPartyKnowledgeBase",
      ],
      resources: ["*"],
    })
  );

  kbDocumentsBucket.addNotifications(stack, {
    syncKnowledgeBase: {
      function: syncKnowledgeBaseFunction,
      events: ["object_created", "object_removed"],
    },
  });

  const web = new StaticSite(stack, "web", {
    path: "packages/web",
    buildOutput: "dist",
    buildCommand: "npm run build",
    environment: {
      VITE_APP_PROMPT_URL: promptFunction.url ?? "",
    },
  });

  stack.addOutputs({
    promptUrl: promptFunction.url,
    webUrl: web.url,
  });
}
