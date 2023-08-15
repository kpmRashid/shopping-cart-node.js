const { MongoClient } = require('mongodb');
const state = {
    db: null
};

module.exports.connect=async function (done){
    const url='mongodb://0.0.0.0:27017/'
    const client = new MongoClient(url);
    const dbname = 'shopping'
    try{
        await client.connect();
        const db = client.db(dbname);
        state.db=db
        return done()
    } catch(err){
        return done(err)
    }
}
module.exports.get=function(){
    return state.db
}