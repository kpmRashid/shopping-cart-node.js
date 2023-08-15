var db=require('../config/connection')
var collection=require('../config/collections')
const bcrypt=require('bcrypt')
const { ObjectId } = require('mongodb'); // Import ObjectId from the mongodb module
const { response } = require('../app');

module.exports = {
    doSignup: async (userData) => {
        try {
            const salt = await bcrypt.genSalt(10);
            userData.Password = await bcrypt.hash(userData.Password, salt);
            const data = await db.get().collection(collection.USER_COLLECTION).insertOne(userData);

            // Use ObjectId constructor with 'new' keyword
            const insertedId = new ObjectId(data.insertedId);

            const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: insertedId });
            if (user) {
                return user; // Resolve with the newly created user's details
            } else {
                throw new Error('Failed to create user. Data not available.');
            }
        } catch (err) {
            console.error(err); // Log the error to the console
            throw err; // Throw the error to be caught by the calling function
        }
    },

    doLogin: async (userData) => {
        try {
            console.log("Trying to find user with email:", userData.Email);
            const user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email });
            console.log("User data found:", user);
            if (user) {
                const passwordMatch = await bcrypt.compare(userData.Password, user.Password);
                if (passwordMatch) {
                    console.log('Login success');
                    return { status: true, user }; // Return an object with status and user properties
                } else {
                    console.log('Login failed: Incorrect password');
                    return { status: false }; // Return an object with only the status property
                }
            } else {
                console.log('Login failed: User not found');
                return { status: false }; // Return an object with only the status property
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    },
    addToCart:(proId,userId)=>{
        let proObj={
            item:new ObjectId(proId),
            quantity:1
        }
        return new Promise(async(resolve,reject)=>{

        let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({user: new ObjectId(userId)})
        if(userCart){
            let proExist = userCart.products.findIndex(product=>product.item==proId)
            console.log(proExist);
            if(proExist!=-1){
                db.get().collection(collection.CART_COLLECTION).updateOne({user:new ObjectId(userId),'products.item':new ObjectId(proId)},
                {
                    $inc:{'products.$.quantity':1}
                }).then(()=>{
                    resolve()
                })
            }else{
            db.get().collection(collection.CART_COLLECTION).updateOne({user:new ObjectId(userId)},
            {
                 $push:{products:proObj}
            }
            
            ).then((response)=>{
                resolve()
            })
        }
        }else{
            let cartObj={
                user:new ObjectId(userId),
                products:[proObj]
            }
            db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response)=>{
                resolve()
            })
        }
    })
    },
    getCartProducts:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let cartItems=await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match:{user:new ObjectId(userId)}
                },
                {
                    $unwind:'$products'
                },
                {
                    $project:{
                        item:'$products.item',
                        quantity:'$products.quantity'
                    }
                },
                {
                    $lookup:{
                        from:collection.PRODUCT_COLLECTION,
                        localField:'item',
                        foreignField : '_id',
                        as:'product'
                    }
                },
                {
                    $project:{
                        item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                    }
                }
               
            ]).toArray()
            console.log(cartItems[0].cartItems);
            resolve(cartItems)
        })
    },
    getCartCount:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let count=0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({user:new ObjectId(userId)})
            if(cart){
                count = cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuantity:(details)=>{
        details.count=parseInt(details.count)
        details.quantity=parseInt(details.quantity)
        return new Promise ((resolve,reject)=>{
            if (details.count==-1 && details.quantity == 1){
            db.get().collection(collection.CART_COLLECTION).updateOne({_id:new ObjectId(details.cart)},
            {
                $pull:{products:{item:new ObjectId(details.product)}}
            }
            ).then((response)=>{
                resolve({removeProduct:true})
            })
    }else{
        db.get().collection(collection.CART_COLLECTION).updateOne({_id:new ObjectId(details.cart),
        'products.item':new ObjectId(details.product)},
        
        {
            $inc:{'products.$.quantity':details.count}
        }
        ).then((response)=>{
            resolve({status:true})
        })
    }
})
    },
    getTotalAmount:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let total=await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match:{user:new ObjectId(userId)}
                },
                {
                    $unwind:'$products'
                },
                {
                    $project:{
                        item:'$products.item',
                        quantity:'$products.quantity'
                    }
                },
                {
                    $lookup:{
                        from:collection.PRODUCT_COLLECTION,
                        localField:'item',
                        foreignField : '_id',
                        as:'product'
                    }
                },
                {
                    $project:{
                        item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                    }
                },
                {
                    $group:{
                        _id:null,
                        total:{$sum:{$multiply: ['$quantity', { $toDouble: '$product.Price' }] }}
                    }
                }
               
            ]).toArray()
              console.log(total[0].total);
            resolve(total[0].total)

        })

    },
    placeOrder:(order,products,total)=>{
        return new Promise((resolve,reject)=>{
            console.log(order,products,total);
            let status=order['payment-method']==='COD'?'placed':'pending'
            let orderObj ={
                deliveryDetails:{
                    mobile:order.mobile,
                    address:order.address,
                    pincode:order.pincode
                },
                userId: new ObjectId(order.userId),
                paymentMethod: order['payment-method'],
                products:products,
                totalAmount:total,
                status:status,
                date:new Date()
            }
            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response)=>{
                db.get().collection(collection.CART_COLLECTION).deleteOne({user:new ObjectId(order.userId)})
                resolve()
            })
        })

    },
    getCartProductList:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({user:new ObjectId(userId)})
            resolve(cart.products)
        })
    },
    getUserOrders:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            console.log(userId);
            let orders=await db.get().collection(collection.ORDER_COLLECTION).find({userId:new ObjectId(userId)}).toArray();
            console.log(orders);
            resolve(orders);
        });
    },
    
    getOrderProducts:(orderId)=>{
        return new Promise(async(resolve,response)=>{
            let orderItems=await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match:{_id:new ObjectId(orderId)}
                },
                {
                    $unwind:'$products'
                },
                {
                    $project:{
                        item:'$products.item',
                        quantity:'$products.quantity'
                    }
                },
                {
                    $lookup:{
                        from:collection.PRODUCT_COLLECTION,
                        localField:'item',
                        foreignField:'_id',
                        as:'product'
                    }
                },
                {
                    $project:{
                        item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                    }
                }

            ]).toArray()
            console.log(orderItems)
            resolve(orderItems)
        })
    }
    
    };