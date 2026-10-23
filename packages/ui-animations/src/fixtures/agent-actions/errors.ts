/**
 * Recorded failures from `client.agent.action.generate`, shaped like the
 * `ClientError` @sanity/client throws: `statusCode` plus the parsed body.
 */

type RecordedClientError = Error & {
  statusCode: number;
  responseBody: string;
  details: unknown;
};

function clientError(
  statusCode: number,
  body: { error: string; message: string }
): RecordedClientError {
  return Object.assign(new Error(`${body.error}: ${body.message}`), {
    name: "ClientError",
    statusCode,
    responseBody: JSON.stringify(body),
    details: body,
  });
}

/** The organisation's AI credit budget (or plan quota) is spent. */
export const budgetExhaustedError = (): RecordedClientError =>
  clientError(429, {
    error: "Too Many Requests",
    message: "AI credit usage limit reached for this organization",
  });

/** Any other failure, e.g. the schema has not been deployed yet. */
export const schemaNotFoundError = (): RecordedClientError =>
  clientError(400, {
    error: "Bad Request",
    message: 'Schema "_.schemas.default" not found in dataset "development"',
  });
