import pymysql
import boto3
import os
import sys
import uuid
from urllib.parse import unquote_plus
from PIL import Image
import PIL.Image

#   Configuration values for AWS RDS
endpoint = os.environ.get('database_endpoint')
username = os.environ.get('username')
password = os.environ.get('password')
database_name = os.environ.get('database_name')

#   connection
connection = pymysql.connect(host=endpoint, user=username, passwd=password, db=database_name)

s3_client = boto3.client('s3')
destination_bucket = os.environ.get('destination_bucket')

def resize_image(image_path, resized_path):
    with Image.open(image_path) as image:
        image.thumbnail(tuple(x / 2 for x in image.size))
        image.save(resized_path)

def lambda_handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = unquote_plus(record['s3']['object']['key'])
        tmpkey = key.replace('/', '')
        download_path = '/tmp/{}{}'.format(uuid.uuid4(), tmpkey)
        upload_path = '/tmp/resized-{}'.format(tmpkey)
        s3_client.download_file(bucket, key, download_path)
        resize_image(download_path, upload_path)
        s3_client.upload_file(upload_path, destination_bucket, key)
        
        # Generate the URL to get 'key-name' from 'bucket-name'
        url = s3_client.generate_presigned_url(
            ClientMethod = 'get_object',
            Params = {
                'Bucket': destination_bucket,
                'Key': key
            }
        )
        #   print('url: ' + url)
        
        #   Todo: Database -> Save thumbnail URL

        
        
        