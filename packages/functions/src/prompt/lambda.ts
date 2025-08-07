import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const bedrockClient = new BedrockAgentRuntimeClient({
  region: 'us-east-1',
});

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Prompting...');
  
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const input = body.input;
    const sessionId = body.sessionId;

    console.log(input);

    const command = new RetrieveAndGenerateCommand({
      ...(sessionId && { sessionId }),
      input: {
        text: input,
      },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID!,
          modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        },
      },
    });

    const response = await bedrockClient.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: response.output?.text,
        sessionId: response.sessionId,
        citations: response.citations,
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