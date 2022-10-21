import invariant from "tiny-invariant";

import { HCSTopicMessage, HCSTopicMessagesResponse } from "./api-types";
import { callMirror } from "./client";
import { getNetwork } from "./config";
import { Network } from "./networks";

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
 * Get the base64-decoded string message a message container
 * @param messageContainer A container object with a base64'ed message property
 */
export function parseBase64Message<T>(messageContainer: HasMessage): T {
  const decodedAsString = decodeBase64Message(messageContainer);
  return JSON.parse(decodedAsString) as T;
}

function withAccessToken({ network, accessToken }: { accessToken?: string; network: Network }) {
  return { network, ...(accessToken ? { accessToken } : undefined) };
}

function getMessage({
  network,
  topicId,
  sequenceNumber,
  accessToken,
}: {
  network: Network;
  topicId: string;
  sequenceNumber: number;
  accessToken?: string;
}) {
  return callMirror<HCSTopicMessage>(
    `/api/v1/topics/${topicId}/messages/${sequenceNumber}`,
    withAccessToken({ network, accessToken })
  );
}

async function getAllMessages({
  network,
  topicId,
  accessToken,
}: {
  network: Network;
  topicId: string;
  accessToken?: string;
}) {
  const messages: Array<HCSTopicMessage> = [];
  let next = "";
  do {
    // eslint-disable-next-line no-await-in-loop
    const results = await callMirror<HCSTopicMessagesResponse>(
      next || `/api/v1/topics/${topicId}/messages`,
      withAccessToken({ network, accessToken })
    );
    if (results.messages) {
      messages.push(...results.messages);
    }
    next = results.links?.next ?? "";
  } while (next);
  return messages.sort((a, b) => a.sequence_number - b.sequence_number);
}

export async function getAllHCSMessages({
  network = getNetwork(),
  accessToken,
  topicId,
}: {
  network?: Network | null;
  accessToken?: string;
  topicId: string;
}): ReturnType<typeof getAllMessages> {
  invariant(network, "Network not correctly configured or passed");
  return getAllMessages({ network, topicId, accessToken });
}

export async function getCompleteHCSMessageBySequenceNumber({
  network = getNetwork(),
  accessToken,
  topicId,
  sequenceNumber,
}: {
  network?: Network | null;
  accessToken?: string;
  topicId: string;
  sequenceNumber: number;
}) {
  invariant(network, "Network not correctly configured or passed");
  const hcsResult = await getMessage({ topicId, sequenceNumber, network, accessToken });
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
        network,
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
