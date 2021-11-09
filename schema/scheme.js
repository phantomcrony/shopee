const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let RegionSchema = new Schema({
    
    product_name: {
        type: String,
        required: true,
        unique:true
        
    },
    link: {
        type: String,
        required: true,
        unique:true
        
    },
    priceafter: {
        type: String,
        required: true,
        
    },

},{strict:false });
module.exports = mongoose.model('products', RegionSchema);
