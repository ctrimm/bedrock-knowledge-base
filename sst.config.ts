import { SSTConfig } from "sst";
import { BedrockKbLambdaStack } from "./stacks/bedrock-kb-lambda-stack";

export default {
  config(_input) {
    return {
      name: "knowledge-base-lambda",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(BedrockKbLambdaStack);
  }
} satisfies SSTConfig;
