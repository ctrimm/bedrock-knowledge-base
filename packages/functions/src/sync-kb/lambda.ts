import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockAgentClient, StartIngestionJobCommand } from '@aws-sdk/client-bedrock-agent';

const bedrockClient = new BedrockAgentClient({
  region: 'us-east-1',
});

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Starting syncing...');
  
  try {
    const command = new StartIngestionJobCommand({
      knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID!,
      dataSourceId: process.env.DATA_SOURCE_ID!,
    });

    const response = await bedrockClient.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingestionJobId: response.ingestionJob?.ingestionJobId,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};