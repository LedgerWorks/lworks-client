import invariant from "tiny-invariant";

import { HCSTopicMessage, HCSTopicMessagesResponse } from "./mirror-api-types";
import { MirrorOptions, callMirror } from "./mirror-client";

export type HasMessage = { message: string };

/**
 * Decode an HCS message
 * @param messageContainer A container object with a base64 encoded message property
 * @returns base64 decoded string
 */
export function decodeBase64Message(messageContainer: HasMessage): string {
  return Buffer.from(messageContainer.message, "base64").toString();
}

/**
 * JSON parse the the base64 encoded message within a message container
 * @param messageContainer A container object with a base64'ed message property
 */
export function parseBase64Message<T>(messageContainer: HasMessage): T {
  const decodedAsString = decodeBase64Message(messageContainer);
  return JSON.parse(decodedAsString) as T;
}

function getMessage({
  topicId,
  sequenceNumber,
  callMirrorDelegate,
  ...mirrorOptions
}: MirrorOptions & {
  topicId: string;
  sequenceNumber: number;
  callMirrorDelegate: typeof callMirror;
}) {
  return callMirrorDelegate<HCSTopicMessage>(
    `/api/v1/topics/${topicId}/messages/${sequenceNumber}`,
    mirrorOptions
  );
}

async function getAllMessages({
  topicId,
  callMirrorDelegate,
  ...mirrorOptions
}: MirrorOptions & {
  topicId: string;
  callMirrorDelegate: typeof callMirror;
}) {
  const messages: Array<HCSTopicMessage> = [];
  let next = "";
  do {
    // eslint-disable-next-line no-await-in-loop
    const results = await callMirrorDelegate<HCSTopicMessagesResponse>(
      next || `/api/v1/topics/${topicId}/messages`,
      mirrorOptions
    );
    if (results.messages) {
      messages.push(...results.messages);
    }
    next = results.links?.next ?? "";
  } while (next);
  return messages.sort((a, b) => a.sequence_number - b.sequence_number);
}

/**
 * Gets all HCS Messages from a given topic. This will automatically handle all paging and will
 * return the messages in ascending order based on their sequence number. It will not do any parsing
 * of the messages (ie base64 decoding)
 * @param options Object which must specify the topic ID to parse and optionally the network and
 * access credentials to use.
 */
export async function getAllHCSMessages({
  topicId,
  callMirrorDelegate = callMirror,
  ...mirrorOptions
}: MirrorOptions & {
  topicId: string;
  callMirrorDelegate?: typeof callMirror;
}): ReturnType<typeof getAllMessages> {
  return getAllMessages({ topicId, callMirrorDelegate, ...mirrorOptions });
}

/**
 * Get and base 64 decode a single HCS Message by topic ID and sequence number. This will assemble
 * a message that spans multiple transactions/sequence numbers.
 * @param options Object which must specify the topic ID and sequence number to parse this can
 * optionally include the network and access credentials to use.
 */
export async function getCompleteHCSMessageBySequenceNumber({
  topicId,
  sequenceNumber,
  callMirrorDelegate = callMirror,
  ...mirrorOptions
}: MirrorOptions & {
  topicId: string;
  sequenceNumber: number;
  callMirrorDelegate?: typeof callMirror;
}) {
  const hcsResult = await getMessage({
    topicId,
    sequenceNumber,
    callMirrorDelegate,
    ...mirrorOptions,
  });
  if (!hcsResult || !hcsResult.chunk_info) {
    return null;
  }

  let messageContent = "";
  if (hcsResult.chunk_info.number === 1 && hcsResult.chunk_info.total === 1) {
    messageContent = decodeBase64Message(hcsResult);
  } else {
    invariant(
      hcsResult.chunk_info.total,
      "Returned message has incomplete chunk_info, total is missing"
    );
    invariant(
      hcsResult.chunk_info.number,
      "Returned message has incomplete chunk_info, number is missing"
    );

    // while the chunks for a single message are guaranteed to be in order, we're concerned that they
    // may be interleaved with another message because they occur over multiple CONSENSUSSUBMITMESSAGE
    const slop = hcsResult.chunk_info.total * 3;
    let hasNext = false;
    // we're not at the beginning of this sequence, guess the beginning and start there.
    let currentSequenceNumber = Math.max(
      1,
      sequenceNumber - (hcsResult.chunk_info.number - 1) - slop
    );

    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await getMessage({
        topicId,
        sequenceNumber: currentSequenceNumber,
        callMirrorDelegate,
        ...mirrorOptions,
      });
      invariant(result, "No returned result when getting next message in the sequence");
      invariant(
        result.chunk_info?.total,
        "Returned message has incomplete chunk_info, total is missing"
      );
      invariant(
        result.chunk_info?.number,
        "Returned message has incomplete chunk_info, number is missing"
      );
      invariant(
        result.chunk_info?.initial_transaction_id,
        "Returned message has incomplete chunk_info, initial_transaction_id is missing"
      );
      invariant(
        hcsResult.chunk_info?.initial_transaction_id,
        "Returned message has incomplete chunk_info, initial_transaction_id is missing"
      );
      hasNext =
        result.chunk_info.number !== result.chunk_info.total ||
        result.chunk_info.initial_transaction_id.transaction_valid_start !==
          hcsResult.chunk_info.initial_transaction_id.transaction_valid_start;
      if (hasNext) {
        currentSequenceNumber += 1;
      }

      if (
        result.chunk_info.initial_transaction_id.transaction_valid_start ===
        hcsResult.chunk_info.initial_transaction_id.transaction_valid_start
      ) {
        messageContent = `${messageContent}${decodeBase64Message(result)}`;
      } else if (slop + hcsResult.sequence_number < currentSequenceNumber) {
        return null;
      }
    } while (hasNext);
  }
  return messageContent;
}
