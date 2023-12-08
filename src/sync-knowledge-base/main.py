import boto3


def lambda_handler(event, context):
    knowledge_base_id = event.get('knowledgeBaseId')
    data_source_id = event.get('dataSourceId')

    bedrock_client = boto3.client(
        service_name="bedrock-agent",
        region_name="us-east-1",
    )

    response = bedrock_client.start_ingestion_job(
        knowledgeBaseId=knowledge_base_id,
        dataSourceId=data_source_id,
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": {
            "ingestionJobId": response["ingestionJob"]["ingestionJobId"]
        },
    }
