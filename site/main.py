from __future__ import print_function
from bottle import route, post, run, request, template, static_file, redirect, TEMPLATE_PATH
from pymongo import Connection
from bson import json_util
import os
from functools import reduce
import re

DEVELOPMENT = True
HERE = os.path.dirname(os.path.realpath(__file__))
TEMPLATE_PATH.insert(0, HERE + '/views/')
DB_URL = 'mongodb://localhost:27017/'

connection = Connection(DB_URL)
db = connection.concourses

@route('/')
def home():
  return template('home')

@route('/courses')
@route('/courses/')
@route('/courses/<query:path>')
def courses(query=""):
  # query should be a comma separated list of departments, course
  # numbers, keywords, or ranges, possibly prefixed by "<session tag>/"
  # TODO: parse query and search
  return template('courses')

@post('/courses')
def search():
  # TODO: rewrite query into a get-url friendly link
  if request.forms.query:
    redirect('/courses/' + request.forms.query)
  redirect('/courses')

@route('/requirements')
def requirements():
  return template('requirements')

# serve this one file statically
@route('/data/departments')
def data_departments():
  return static_file('data/departments.json', root=HERE+'/static')

def constraint_map(item):
  if len(item) == 0:
    return {}
  # regex matching
  if re.match(r"^\d{2,2}$", item):
    # department
    return {'department': item}
  if re.match(r"^\d{5,5}$", item):
    # specific course
    return {'number': item}
  return {'name': {'$regex': item, '$options': 'i'}}


@post('/data')
def data():
  empty = json_util.dumps({'courses': []})
  search = request.json
  if type(request.json) is not str:
    return empty
  constraints = [item.strip() for item in search.strip().split(',')]
  if len(constraints) == 0:
    return empty
  features = map(constraint_map, constraints)
  query = reduce(lambda x, y: dict(list(x.items()) + list(y.items())), features)

  print({'$query': query, '$orderby': {'number': 1}})
  result = db.courses.find({'$query': query, '$orderby': {'number': 1}})
  return json_util.dumps({'courses': result})

@route('/static/<filepath:path>')
def server_static(filepath):
  return static_file(filepath, root=HERE+'/static')

run(host='localhost', port=int(os.environ.get("PORT", 8080)),
  server='cherrypy', reloader=DEVELOPMENT, debug=DEVELOPMENT)
