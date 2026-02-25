import urllib.request
import json
import urllib.error

try:
    req = urllib.request.urlopen('http://127.0.0.1:3324/task/576506d4-0e84-4b5e-881e-cbbbc1dc80c7/result')
    print(req.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print(e.read().decode())
