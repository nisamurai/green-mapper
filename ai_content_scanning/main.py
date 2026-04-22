from fastapi import FastAPI

app = FastAPI()

@app.get('/check_image')
def check_image():
    return {'status': 'ok'}
