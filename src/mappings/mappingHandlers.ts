import { Request, Account } from "../types";
import { TerraEvent } from "@subql/types-terra";
import { MsgExecuteContract } from "@terra-money/terra.js";

const checkRequest = (
  event: TerraEvent<MsgExecuteContract>,
  action: string
) => {
  if (
    event.event.attributes[0].value ==
      "terra1za5a509w6jvahlcwepnyfzxlwd3wm4lvpmua4w32ypn2we3gjajq5hfkdv" &&
    event.event.attributes[1].value == action
  ) {
    return true;
  }
  return false;
};

export async function handleCreateRequestEvent(
  event: TerraEvent<MsgExecuteContract>
): Promise<void> {
  if (!checkRequest(event, "create_request")) {
    return;
  }

  const accountId = event.event.attributes[3].value;
  const target = event.event.attributes[4].value;
  const msg = event.event.attributes[5].value;
  const asset = event.event.attributes[6].value;

  const requestId = event.event.attributes[2].value;
  logger.info(`create_request: id = ${requestId}`);

  let account = await Account.get(accountId);
  if (account === undefined) {
    account = Account.create({
      id: accountId,
      address: accountId,
    });
    await account.save();
  }

  const request = Request.create({
    id: requestId,
    registerId: accountId,
    txHash: event.tx.tx.txhash,
    target,
    msg,
    assets: asset.slice(11, -1),
    executor: "",
    status: "created",
    createdAt: event.block.block.block.header.time,
    executedOrCancelledAt: "",
  });

  await request.save();
}

export async function handleExecuteRequestEvent(
  event: TerraEvent<MsgExecuteContract>
): Promise<void> {
  if (!checkRequest(event, "execute_request")) {
    return;
  }

  const requestId = event.event.attributes[2].value;
  logger.info(`execute_request: id = ${requestId}`);

  const request = await Request.get(requestId);
  if (request === undefined) {
    logger.error(`execute_request: not found: id = ${requestId}`);
    return;
  }

  request.executor =
    event.msg.tx.tx.tx.auth_info.signer_infos[0].public_key.address();
  request.status = "executed";
  request.executedOrCancelledAt = event.block.block.block.header.time;

  await request.save();
}

export async function handleCancelRequestEvent(
  event: TerraEvent<MsgExecuteContract>
): Promise<void> {
  if (!checkRequest(event, "cancel_request")) {
    return;
  }

  const requestId = event.event.attributes[2].value;
  logger.info(`cancel_request: id = ${requestId}`);

  const request = await Request.get(requestId);
  if (request === undefined) {
    logger.error(`cancel_request: not found: id = ${requestId}`);
    return;
  }

  request.status = "cancelled";
  request.executedOrCancelledAt = event.block.block.block.header.time;

  await request.save();
}
