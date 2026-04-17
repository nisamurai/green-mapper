from aiohttp import ClientSession, ClientTimeout
from aiohttp_retry import RetryClient, RandomRetry
import logging
import os
import aio_pika
from minio import Minio
import pprint
import time

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

back_host = "backend" if os.getenv("IN_CONTAINER") else "localhost"
bucket = os.getenv("MINIO_MAIN_BUCKET", "")
secret = os.getenv("BETTER_AUTH_SECRET", "")
timeout = ClientTimeout(total=10)
retry_options = RandomRetry(attempts=5)


# Initialize the client
client = Minio(
    f"{"minio" if os.getenv("IN_CONTAINER") else "localhost"}:9000",
    access_key=os.getenv("MINIO_ROOT_USER"),
    secret_key=os.getenv("MINIO_ROOT_PASSWORD"),
    secure=False
)

async def handle_issue_created(data: dict, message: aio_pika.IncomingMessage):
    issue_id = data.get("issueId")
    timestamp = data.get("timestamp")
    logger.info(f"Processing issue {issue_id} created at {timestamp}")
    async with ClientSession(timeout=timeout) as session:
        retry_client = RetryClient(session)
        async with retry_client.get(
            f"http://{back_host}:3000/reports/{issue_id}",
            headers={"x-service-key": secret},
            retry_options=retry_options,
        ) as response:
            response.raise_for_status()

            issue = await response.json()

    # TODO: получить фотки из minio
    files = [
        client.get_object(
            bucket_name=bucket,
            object_name=link.replace(f"{bucket}/", "")
        ).read()
        for link in issue["links"]
    ]
    llm_answer = await check(issue, files)

    async with ClientSession(timeout=timeout) as session:
        retry_client = RetryClient(session)
        if llm_answer["verified"]:
            async with retry_client.put(
                f"http://{back_host}:3000/reports/{issue_id}/status",
                headers={"x-service-key": secret},
                json={"statusId": 1},
                retry_options=retry_options,
            ) as response:
                response.raise_for_status()
                logger.info(f"issue {issue_id} verified")
        else:
            async with retry_client.delete(
                f"http://{back_host}:3000/reports/{issue_id}",
                headers={"x-service-key": secret},
                retry_options=retry_options,
            ) as response:
                response.raise_for_status()
                logger.info(f"issue {issue_id} not verified, reason: {llm_answer["message"]}")

    logger.info(f"Issue {issue_id} processed successfully")


async def check(issue, files):
    time.sleep(10)
    logger.info(f"issue: {pprint.pformat(issue)}. files len: {len(files)}")
    return {"verified": True, "message": ""}
