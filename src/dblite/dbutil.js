module.exports = {
    getSelectTable:function (sql){
    //TODO checktable()
    var array = sql.replace('\'','').replace(/\"/g,'').split(' from ')
    console.log( array); 
    var tables =[]
    array.forEach(element => {
      this.dropOtherChar(tables.push(element.split(' ')[0]))
    });
    tables.shift()
    return tables
  },
  getModifyTable:function (sql){
    var array = sql.split(' ')
    switch(array[0].toLowerCase())
    {
    case 'delete':
    case 'insert':
    return [this.dropOtherChar(array[2])]
    case 'update':
    return [this.dropOtherChar(array[1])]
    default: return null
    }
  },
  dropOtherChar:function (s){
    const regex = /^[a-zA-Z_]{1,}$/
    ret = []
    for(i = 0;i<s.length-1;i++){
     let c= s.charAt(i)
      if(regex.test(c)){
        ret.push(c)
      }else{
        break;
      }
    }
    return ret.join("")
  },
  checkTable :function (){
  
  },
  getAllTableName:function (){
  
  }
}