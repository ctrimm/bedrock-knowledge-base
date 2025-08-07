/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "knowledge-base-lambda",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    await import("./stacks/bedrock-kb-lambda-stack");
  },
});
