import { StackContext, Function, Bucket } from "sst/constructs";
import { BedrockKnowledgeBase } from "bedrock-agents-cdk";
import * as iam from "aws-cdk-lib/aws-iam";

export function BedrockKbLambdaStack({ stack }: StackContext) {
  const promptFunction = new Function(stack, "prompt", {
    runtime: "python3.12",
    handler: "packages/functions/src/prompt/lambda.handler",
    python: {
      noDocker: true,
    },
    copyFiles: [{ from: "py-bundles/prompt-py-bundle", to: "./" }],
    url: true,
  });

  const kbDocumentsBucket = new Bucket(stack, "kb-documents");

  const bedrockKb = new BedrockKnowledgeBase(
    stack,
    "BedrockOpenSearchKnowledgeBase",
    {
      name: "knowledge-base-sst",
      roleArn:
        "arn:aws:iam::637732166235:role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_7yi0z",
      storageConfiguration: {
        pineconeConfiguration: {
          connectionString:
            "https://kb-sst-test-3xrbu48.svc.gcp-starter.pinecone.io",
          credentialsSecretArn:
            "arn:aws:secretsmanager:us-east-1:637732166235:secret:pinecon-api-ley-JTCk8V",
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
    }
  );

  const syncKnowledgeBaseFunction = new Function(stack, "sync-kb", {
    runtime: "python3.12",
    handler: "packages/functions/src/sync-kb/lambda.handler",
    python: {
      noDocker: true,
    },
    copyFiles: [{ from: "py-bundles/sync-kb-py-bundle", to: "./" }],
    environment: {
      KB_NAME: bedrockKb.name,
    },
  });

  syncKnowledgeBaseFunction.addToRolePolicy(
    new iam.PolicyStatement({
      sid: "StartIngestionJob",
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:StartIngestionJob",
        "bedrock:AssociateThirdPartyKnowledgeBase",
      ],
      resources: ["*"],
    })
  );

  kbDocumentsBucket.addNotifications(stack, {
    syncKnowledgeBase: { function: syncKnowledgeBaseFunction, events: ["object_created", "object_removed"] },
  });

  stack.addOutputs({
    promptUrl: promptFunction.url,
  });
}
