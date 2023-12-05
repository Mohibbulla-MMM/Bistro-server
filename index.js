const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'mohibbullah',
    key: process.env.MAIL_GUN_API_KEY,
});
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 7000

const stripe = require('stripe')(process.env.VITE_STRIPE_SECRET_KEY)
// middle ware -------------------------
app.use(express.json())
app.use(cors())
console.log(process.env.DB_NAME);
console.log(process.env.DB_PASS);

// token varify middle ware ----------------------
const tokenVarify = (req, res, next) => {
    // console.log('---------------', req.headers.authorization, '---------------',);
    // console.log({ req });
    // console.log({req});
    if (!req.headers.authorization) {
        res.status(401).send({ Message: "Unauthorize 1" })
    }
    const token = req.headers.authorization.split(' ')[1]
    // console.log("25 token ", token);
    // token varify ---------
    jwt.verify(token, process.env.SECRET_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(401).send({ Message: "Unauthorize 2" })
        }
        // console.log({ decoded });
        req.decoded = decoded
        // console.log(decoded);

        next()
    });
}

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.xevn9vs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const menuCollection = client.db("bistroDB").collection('menu')
        const reviewsCollection = client.db("bistroDB").collection('reviews')
        const cartsCollection = client.db("bistroDB").collection('carts')
        const usersCollection = client.db("bistroDB").collection('users')
        const paymentsCollection = client.db("bistroDB").collection('payments')

        // verify admin middleWare  ------------
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            // console.log('>>>>>>>>>>>>>>>>>>>>>>>>', email);
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // console.log('>>>>>>>>>>>>>>>>>>>>>>>>', user);
            const isAdmin = user?.role === 'admin'
            // console.log({ isAdmin });
            console.log(`${email} <----: Admin roll :---> ${isAdmin}`);
            if (!isAdmin) {
                return res.status(403).send({ Message: 'Forbiden access' })
            }
            next()
        }

        // ########## ###### stripe payment #####################
        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { price } = req.body;
                console.log({ price });
                const amount = parseInt(price * 100)
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
                    payment_method_types: [
                        "card"
                    ],
                })
                console.log({ paymentIntent });
                // res.send(
                //     "bclientSecret: paymentIntent.client_secret,"
                // )
                res.send({
                    clientSecret: paymentIntent.client_secret,
                })
            }
            catch (err) {
                console.log(err);
            }
        })
        // all menu get api
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        // all menu get api
        app.get('/menu/:id', async (req, res) => {
            try {
                const id = req.params.id
                const query = { _id: new ObjectId(id) }

                const result = await menuCollection.findOne(query)
                res.send(result)
                console.log("single menu get ", id);
            }
            catch (err) {
                res.send(err)
                console.log();
            }
        })

        // menu update / manage update item page
        app.patch('/menu/:id', async (req, res) => {
            try {
                const data = req.body
                console.log({ data });
                const id = req.params.id
                const query = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        name: data.name,
                        price: data.price,
                        category: data.category,
                        recipe: data.recipe,
                    }
                }
                console.log({ updatedDoc });
                const result = await menuCollection.updateOne(query, updatedDoc)


                res.send(result)
                console.log("single menu update ", id);
            }
            catch (err) {
                res.send(err)
                console.log();
            }
        })

        //admin  menu post  api
        app.post('/menu', tokenVarify, verifyAdmin, async (req, res) => {
            try {
                const data = req.body;
                // console.log({ data });
                // console.log(data);
                const result = await menuCollection.insertOne(data)
                res.send(result)
                console.log("Admin menu add success: ", data?.name);
            }
            catch (errr) {
                console.log(errr);
            }
        })

        //  menu item delete api / manage all item page
        app.delete('/menu/:id', tokenVarify, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await menuCollection.deleteOne(query)
                res.send(result)
                console.log("Admin menu deleted success",);
            }
            catch (errr) {
                console.log(errr);
            }
        })

        // rewiews
        app.get('/reviews', async (req, res) => {
            try {
                const result = await reviewsCollection.find().toArray()
                res.send(result)
            }
            catch (err) {
                console.log(err);
                res.send(err)
            }
        })

        // user add to cart food 
        app.post('/carts', async (req, res) => {
            try {
                const data = req.body
                console.log(data);
                const result = await cartsCollection.insertOne(data)
                res.send(result)
            }
            catch (err) {
                console.log(err);
                res.send({ err })
            }
        })

        // user add to cart food 
        app.get('/carts', async (req, res) => {
            try {
                const email = req?.query?.email
                console.log({ email },);
                const query = { email: email }
                const result = await cartsCollection.find(query).toArray()
                res.send(result)
                console.log(`${email} user cart item get`);
            }
            catch (err) {
                console.log(err);
                res.send({ err })
            }
        })

        // admin state --------
        app.get('/admin-state', tokenVarify, async (req, res) => {
            try {
                const users = await usersCollection.estimatedDocumentCount()
                const menuItems = await menuCollection.estimatedDocumentCount()
                const orders = await paymentsCollection.estimatedDocumentCount()

                const price = await paymentsCollection.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$price' }
                        }
                    }
                ]).toArray()

                const revinue = price.length > 0 ? price[0].totalRevenue : 0;

                res.send({
                    users,
                    menuItems,
                    orders,
                    revinue
                })
            }
            catch (err) {
                console.log(err);
            }
        })

        // using aggregate pipeline 
        app.get('/order-stats', async (req, res) => {
            try {
                const result = await paymentsCollection.aggregate([

                    { $unwind: '$menuItemIds' },

                    {
                        $lookup: {
                            from: "menu",
                            let: { objectId: { $toObjectId: "$menuItemIds" } },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: [
                                                { $toObjectId: "$_id" },  // Convert foreignId to ObjectId
                                                "$$objectId"
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "combinedData"
                        }
                    },
                    { $unwind: '$combinedData' },


                    {
                        $group: {
                            _id: '$combinedData.category',
                            quantity: { $sum: 1 },
                            revenue: { $sum: '$combinedData.price' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            category: '$_id',
                            quantity: '$quantity',
                            revenue: '$revenue'
                        }
                    }
                ]).toArray();
                // console.log(result);
                //    bd268       
                res.send(result);
                console.log('Admin order state: ', result.length);
            } catch (err) {
                console.log(err);

            }
        });



        // user cart page item delete 
        app.delete('/carts/:id', async (req, res) => {
            const id = req?.params?.id
            const query = { _id: new ObjectId(id) }
            const result = await cartsCollection.deleteOne(query)
            console.log(result);
            res.send(result)
        })



        // user save api -------------
        app.post('/users', async (req, res) => {

            try {
                const user = req.body;
                const query = { email: user.email }
                const isExist = await usersCollection.findOne(query)
                if (isExist) {
                    console.log({ isExist });
                    return res.send({ Message: "This user already axist", insertedId: null })
                }
                const result = await usersCollection.insertOne(user)
                res.send(result)
                console.log("Save this user: ", user);
            }
            catch (err) {
                res.send("User Not Save: ", err)
                console.log(err);
            }
        })
        // payment  save api -------------
        app.post('/payments', async (req, res) => {
            try {
                const data = req.body;
                const paymentResult = await paymentsCollection.insertOne(data)
                // console.log('payment result ', paymentResult);
                res.send(paymentResult)
                const query = {
                    _id:
                        { $in: data.cardIds.map(id => new ObjectId(id)) }
                }
                const deleteResult = await cartsCollection.deleteMany(query)

                mg.messages
                    .create(process.env.MAIL_SENDING_DOMAIN, {
                        from: "Mailgun Sandbox <postmaster@sandboxddbce8ad81bd4f3fa3e8a452bb759635.mailgun.org>",
                        to: ["rockychain1020@gmail.com"],
                        subject: "Bistro Boss Confirmation Email",
                        text: "Testing some Mailgun awesomness!",
                        html: `
                    <h1>Thank You for your order</h1>
                    <h3>Yor transaction Id: ${paymentResult.transactionId}</h3>
                    `
                    })
                    .then(msg => {
                        console.log("--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------", msg)
                    }) // logs response data
                    .catch(err => { console.log("--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------", err) }); // logs any error`;



                // console.log("Save this user: ", data);
            }
            catch (err) {
                // res.send("payment Not Save: ", err)
                console.log(err);
            }
        })
        // single user email payment history // payment history page--------
        app.get('/payments/:email', tokenVarify, async (req, res) => {
            const email = req.params.email
            // console.log(email , '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
            if (email !== req.decoded.email) {
                return res.send({ Message: "Forbidden access" })
            }
            // console.log(req.decoded.email, ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
            const query = { email: email }
            const result = await paymentsCollection.find(query).toArray()
            res.send(result)
        })
        // all users get api -------------
        app.get('/users', tokenVarify, async (req, res) => {

            try {
                const result = await usersCollection.find().toArray()
                res.send(result)
                console.log("All users get ");
            }
            catch (err) {
                res.send("All Don't get: ", err)
                console.log(err);
            }
        })

        // admin  users delete api -------------
        app.delete('/users/:id', async (req, res) => {
            try {
                const id = req.params.id
                const query = { _id: new ObjectId(id) }

                const result = await usersCollection.deleteOne(query)
                res.send(result)
                console.log("Admin This user delete: ", result);
            }
            catch (err) {
                res.send("Admin user deleted failed")
                console.log(err);
            }
        })

        // make admin api ----------------
        app.patch('/users/admin/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        role: 'admin'
                    }
                }
                const result = await usersCollection.updateOne(filter, updatedDoc)
                res.send(result)
            }
            catch (err) {
                res.send({ message: "Admin create failed" })
                console.log(err);
            }
        })


        // admin role get api ----------
        app.get('/users/admin/:email', tokenVarify, async (req, res) => {
            try {
                const email = req.params?.email;
                console.log('verify email 000000', { email });
                const query = { email: email }
                const user = await usersCollection.findOne(query)
                console.log('user 000000', { user });
                let admin = false;
                if (user) {
                    if (user?.role) {
                        admin = user?.role === "admin"
                    }
                }
                console.log({ 'This user is admin: ': admin });
                res.send({ admin })
            }
            catch (err) {
                console.log(err);
            }

        })
        // tokent create  api 
        app.post('/jwt', async (req, res) => {
            try {
                const user = req.body
                console.log(user);
                const token = jwt.sign(user, process.env.SECRET_TOKEN, {
                    expiresIn: '2h'
                })
                res.send({ token })
                console.log(token);
            }
            catch (err) {
                res.status(402).send({ message: 'Token Not Create' })
                console.log(err);
            }


        })



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("<h1>Bistro Boss Is Running</h1>")
})

app.listen(port, () => {
    console.log(`Bistro server is running on port: ${port}`);
})



// app.get('/order-states', async (req, res) => {
//     const result = await paymentCollection
//       .aggregate([
//         {
//           $unwind: '$menuItemIds',
//         },
//         // { $addFields: { _Id: { $toString: '$_id' } } },
//         { $project: { menuItemId: { $toObjectId: '$menuItemIds' } } },

//         {
//           $lookup: {
//             from: 'menu',
//             localField: 'menuItemId',
//             foreignField: '_id',

// foreignField: '_id'.toString(),