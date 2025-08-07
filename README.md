# Amazon Bedrock architecture with Knowledge Base and Lambda using SST

This is a proof of concept that uses Amazon Bedrock to create a chatbot.

It uses: 
- SST v3 to deploy everything to AWS
- Aurora PostgreSQL Serverless v2 with pgvector as vector database
- Lambda functions in TypeScript with AWS SDK v3
- NextJS for the web interface

## Architecture

```mermaid
graph TB
    User[User] --> NextJS[NextJS Web App]
    
    NextJS --> PromptLambda[Prompt Lambda Function<br/>TypeScript + AWS SDK v3]
    
    Documents[Documents] --> S3[S3 Bucket<br/>bedrock-kb-documents]
    S3 --> SyncLambda[Sync Lambda Function<br/>TypeScript + AWS SDK v3]
    
    S3 --> BedrockKB[Amazon Bedrock<br/>Knowledge Base]
    SyncLambda --> BedrockKB
    
    BedrockKB --> Aurora[Aurora PostgreSQL<br/>Serverless v2 + pgvector]
    BedrockKB --> TitanEmbed[Amazon Titan<br/>Embedding Model]
    
    PromptLambda --> BedrockAgent[Bedrock Agent Runtime<br/>RetrieveAndGenerate]
    BedrockAgent --> BedrockKB
    BedrockAgent --> Claude[Claude 3.5 Sonnet v2<br/>Foundation Model]
    
    BedrockAgent --> Response[Response with<br/>Citations]
    Response --> NextJS
    
    classDef aws fill:#ff9900,stroke:#232f3e,stroke-width:2px,color:#fff
    classDef user fill:#4285f4,stroke:#1a73e8,stroke-width:2px,color:#fff
    classDef app fill:#0f9d58,stroke:#137333,stroke-width:2px,color:#fff
    
    class S3,BedrockKB,Aurora,TitanEmbed,BedrockAgent,Claude,SyncLambda,PromptLambda aws
    class User user
    class NextJS,Documents,Response app
```

## Get started

Setup your IAM credentials: [https://docs.sst.dev/advanced/iam-credentials](https://docs.sst.dev/advanced/iam-credentials)

Execute the following commands:

```
npm install
npm run deploy
```
