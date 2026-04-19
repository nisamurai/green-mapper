import asyncio
import json
import logging
import os
import time

import aio_pika

from .handle_issue_created import handle_issue_created

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

class RabbitMQClient:
    def __init__(self):
        self.connection: aio_pika.abc.AbstractRobustConnection | None = None
        self.channel: aio_pika.abc.AbstractRobustChannel | None = None
        self.is_consuming = False
        
        self.user = os.getenv("RABBITMQ_USER")
        self.password = os.getenv("RABBITMQ_PASSWORD")
        self.host = "rabbitmq" if os.getenv("IN_CONTAINER") else "localhost"
        self.url = f"amqp://{self.user}:{self.password}@{self.host}:5672"
    
    async def connect(self):
        try:
            self.connection = await aio_pika.connect_robust(self.url, reconnect_interval=5)
            self.channel = await self.connection.channel()
            
            logger.info("Connected to RabbitMQ")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise
    
    async def consume_issues(self, callback):
        """Consume messages from issue.created queue"""
        if not self.channel:
            raise Exception("Channel not available")
        
        # Just get the queue reference, don't create it
        queue = await self.channel.get_queue("issue.created.queue")
        
        self.is_consuming = True
        
        async def on_message(message: aio_pika.IncomingMessage):
            async with message.process():
                try:
                    body = json.loads(message.body.decode())
                    logger.info(f"Received message: {body}")
                    await callback(body, message)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    await message.reject(requeue=True)
        
        await queue.consume(on_message)
        logger.info("Started consuming issue.created messages")
        
        while self.is_consuming:
            await asyncio.sleep(1)
    
    async def close(self):
        self.is_consuming = False
        if self.connection:
            await self.connection.close()
            logger.info("RabbitMQ connection closed")

async def main():
    logger.info("waiting for brocker startup")
    time.sleep(float(os.getenv("RABBITMQ_DELAY_SECONDS", "0")))
    logger.info("attempt to connect")
    client = RabbitMQClient()
    
    try:
        await client.connect()
        
        # Start consuming
        asyncio.create_task(client.consume_issues(handle_issue_created))
        
        # Keep running
        await asyncio.Event().wait()
        
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())