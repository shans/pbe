const Promise = require('bluebird');
const Datastore = Promise.promisifyAll(require('@google-cloud/datastore'));

const projectId = 'pbe-test-project';

const datastoreClient = Datastore({
  projectId: projectId
});

var key = function(keyList) {
  return datastoreClient.key(keyList);
}
exports.key = key;

var save = function(obj, type, parent) { 
  var rec = {
    key: key([type, obj.key]),
    data: obj.data
  }
  console.log(rec);
  return datastoreClient.saveAsync(rec);
}

exports.save = save;

var get = function(obj, type, parent) {
  return datastoreClient.getAsync(key([type, obj.key])).then(entity => obj.data = entity);
}
exports.get = get;
