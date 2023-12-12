import boto3
import json


def handler(event, context):
    print("Prompting...")
    bedrock_client = boto3.client(
        service_name="bedrock-agent-runtime",
        region_name="us-east-1",
    )

    body = json.loads(event['body'])
    input = body['input']
    knowledge_base_id = body['knowledgeBaseId']

    print(input, knowledge_base_id)

    response = bedrock_client.retrieve_and_generate(
        input={
            'text': input
        },
        retrieveAndGenerateConfiguration={
            'type': 'KNOWLEDGE_BASE',
            'knowledgeBaseConfiguration': {
                'knowledgeBaseId': knowledge_base_id,
                'modelArn': 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2'
            }
        }
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": {
            "text": json.dumps(response["output"]["text"]),
            "sessionId": response["sessionId"],
            "citations": response["citations"]
        },
    }