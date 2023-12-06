import boto3
import json


def lambda_handler(event, context):
    bedrock_agent_runtime = boto3.client(
        service_name="bedrock-agent-runtime",
        region_name="us-east-1",
    )

    input = event.get('input')

    response = bedrock_agent_runtime.retrieve_and_generate(
        input={
            'text': input
        },
        retrieveAndGenerateConfiguration={
            'type': 'KNOWLEDGE_BASE',
            'knowledgeBaseConfiguration': {
                'knowledgeBaseId': 'your_knowledge_base_id',
                'modelArn': 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2'
            }
        }
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps(response["output"]["text"]),
    }
