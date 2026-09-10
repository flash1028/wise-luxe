const express = require("express");
const path = require("path");
const fs = require("fs");
const basicAuth = require("express-basic-auth");

require("dotenv").config();

const { createClient } =
    require("@supabase/supabase-js");


/* =========================================================
   APP
========================================================= */

const app = express();

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   SUPABASE
========================================================= */

const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY
    );


/* =========================================================
   FILE LOCATIONS
========================================================= */

const publicFolder =
    path.join(
        __dirname,
        "public"
    );

const ordersFile =
    path.join(
        __dirname,
        "orders.json"
    );


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    express.json()
);


app.use(
    "/owner-dashboard.html",
    basicAuth({
        users: {
            owner:
                process.env.OWNER_PASSWORD
        },
        challenge: true
    })
);


app.use(
    express.static(
        publicFolder
    )
);


/* =========================================================
   CREATE ORDERS FILE
========================================================= */

function makeOrdersFile() {

    if (
        !fs.existsSync(
            ordersFile
        )
    ) {

        fs.writeFileSync(
            ordersFile,
            JSON.stringify(
                [],
                null,
                2
            )
        );

    }

}

makeOrdersFile();


/* =========================================================
   READ ORDERS
========================================================= */

function getOrders() {

    try {

        const data =
            fs.readFileSync(
                ordersFile,
                "utf8"
            );

        return JSON.parse(
            data
        );

    } catch (error) {

        console.error(
            "Could not read orders:",
            error
        );

        return [];

    }

}


/* =========================================================
   SAVE ORDERS
========================================================= */

function saveOrders(
    orders
) {

    fs.writeFileSync(
        ordersFile,
        JSON.stringify(
            orders,
            null,
            2
        )
    );

}


/* =========================================================
   OWNER AUTH
========================================================= */

const ownerAuth =
    basicAuth({
        users: {
            owner:
                process.env.OWNER_PASSWORD
        },
        challenge: true
    });


/* =========================================================
   VERIFY CUSTOMER AUTHENTICATION
========================================================= */

async function getAuthenticatedCustomer(
    req
) {

    try {

        const authHeader =
            req.headers.authorization || "";


        /* -----------------------------------------
           CHECK AUTHORIZATION HEADER
        ----------------------------------------- */

        if (
            !authHeader.startsWith(
                "Bearer "
            )
        ) {

            return {
                success: false,
                status: 401,
                message:
                    "You must be logged in to place an order."
            };

        }


        const accessToken =
            authHeader
                .replace(
                    "Bearer ",
                    ""
                )
                .trim();


        if (!accessToken) {

            return {
                success: false,
                status: 401,
                message:
                    "Invalid login session."
            };

        }


        /* -----------------------------------------
           ASK SUPABASE WHO OWNS THIS TOKEN
        ----------------------------------------- */

        const {
            data,
            error
        } =
            await supabase.auth.getUser(
                accessToken
            );


        if (
            error ||
            !data ||
            !data.user
        ) {

            console.error(
                "CUSTOMER AUTHENTICATION FAILED:",
                error
            );

            return {
                success: false,
                status: 401,
                message:
                    "Your login session is invalid or expired."
            };

        }


        /* -----------------------------------------
           AUTHENTICATED CUSTOMER
        ----------------------------------------- */
return {
    success: true,
    user: data.user,
    accessToken: accessToken
};


    } catch (error) {

        console.error(
            "AUTHENTICATION CHECK ERROR:",
            error
        );

        return {
            success: false,
            status: 401,
            message:
                "Unable to verify your login session."
        };

    }

}


/* =========================================================
   GET PRODUCTS FROM SUPABASE
========================================================= */

app.get(
    "/api/products",
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("products")
                    .select("*")
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "Supabase products error:",
                    error
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        error.message

                });

            }


            res.json({

                success: true,

                products:
                    data

            });


        } catch (error) {

            console.error(
                "Error loading products:",
                error
            );

            res.status(
                500
            ).json({

                success: false,

                message:
                    "Server error while loading products."

            });

        }

    }
);


/* =========================================================
   RECEIVE NEW ORDER
   AUTHENTICATION REQUIRED
========================================================= */

app.post(
    "/api/orders",
    async (
        req,
        res
    ) => {

        try {

            /* -----------------------------------------
               VERIFY CUSTOMER FIRST
            ----------------------------------------- */

            const auth =
                await getAuthenticatedCustomer(
                    req
                );


            if (
                !auth.success
            ) {

                return res.status(
                    auth.status
                ).json({

                    success: false,

                    message:
                        auth.message

                });

            }


            /* -----------------------------------------
               THIS IS THE REAL SUPABASE USER
            ----------------------------------------- */

            const authenticatedUser =
                auth.user;


            const authenticatedCustomerId =
                authenticatedUser.id;
            
const accessToken =
    auth.accessToken;

const customerSupabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
            global: {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        }
    );
            console.log(
                "AUTHENTICATED CUSTOMER:",
                authenticatedCustomerId
            );


            /* -----------------------------------------
               GET ORDER
            ----------------------------------------- */

            const order =
                req.body;


            if (!order) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "No order data received."

                });

            }


            if (
                !order.orderNumber
            ) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Order number is required."

                });

            }


            /* -----------------------------------------
               CHECK IF ORDER ALREADY EXISTS
            ----------------------------------------- */

            const {
                data: existingOrder,
                error: checkError
            } =
                await supabase
                    .from("orders")
                    .select(
                        "id, order_number"
                    )
                    .eq(
                        "order_number",
                        order.orderNumber
                    )
                    .maybeSingle();


            if (checkError) {

                console.error(
                    "Error checking existing order:",
                    checkError
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        "Unable to check existing orders."

                });

            }


            if (
                existingOrder
            ) {

                return res.json({

                    success: true,

                    message:
                        "Order already exists.",

                    order:
                        order

                });

            }


            /* -----------------------------------------
               SAVE ORDER
               
               IMPORTANT:
               customer_id comes from Supabase
               authentication, NOT the browser.
            ----------------------------------------- */

            const {
                data,
                error
            } =
               await customerSupabase
                    .from("orders")
                    .insert({

                        order_number:
                            order.orderNumber,

                        customer_id:
                            authenticatedCustomerId,

                        customer_name:
                            order.customer?.name ||
                            "",

                        phone:
                            order.customer?.phone ||
                            "",

                        email:
                            order.customer?.email ||
                            authenticatedUser.email ||
                            "",

                        delivery_address:
                            order.customer?.address ||
                            "",

                        city:
                            order.customer?.city ||
                            "",

                        state:
                            order.customer?.state ||
                            "",

                        items:
                            order.items ||
                            [],

                        total:
                            Number(
                                order.total
                            ) || 0,

                        payment_method:
                            order.paymentMethod ||
                            "WhatsApp",

                        status:
                            order.status ||
                            "Pending",

                        delivered_date:
                            order.deliveredDate ||
                            null

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Supabase order error:",
                    error
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        error.message

                });

            }


            console.log(
                "NEW WISE LUXE ORDER SAVED:",
                order.orderNumber
            );

            console.log(
                "CUSTOMER ID:",
                authenticatedCustomerId
            );


            res.json({

                success: true,

                message:
                    "Order saved successfully.",

                order:
                    order,

                databaseOrder:
                    data

            });


        } catch (error) {

            console.error(
                "Error saving order:",
                error
            );

            res.status(
                500
            ).json({

                success: false,

                message:
                    "Server error while saving order."

            });

        }

    }
);


/* =========================================================
   GET CUSTOMER ORDERS
========================================================= */

app.get(
    "/api/customer-orders",
    async (
        req,
        res
    ) => {

        try {

            /* -----------------------------------------
               VERIFY CUSTOMER
            ----------------------------------------- */

            const auth =
                await getAuthenticatedCustomer(
                    req
                );


            if (
                !auth.success
            ) {

                return res.status(
                    auth.status
                ).json({

                    success: false,

                    message:
                        auth.message

                });

            }


            const customerId =
                auth.user.id;

const accessToken = auth.accessToken;

const customerSupabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY,
        {
            global: {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        }
    );

            /* -----------------------------------------
               GET ONLY THIS CUSTOMER'S ORDERS
            ----------------------------------------- */

            const {
                data,
                error
            } =
                await customerSupabase
                    .from("orders")
                    .select("*")
                    .eq(
                        "customer_id",
                        customerId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );


            if (error) {

                console.error(
                    "CUSTOMER ORDERS ERROR:",
                    error
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        "Could not load your orders."

                });

            }


            /* -----------------------------------------
               FORMAT ORDERS
            ----------------------------------------- */

            const orders =
                data.map(
                    function(order) {

                        return {

                            orderNumber:
                                order.order_number,

                            date:
                                order.created_at
                                    ? new Date(
                                        order.created_at
                                    ).toLocaleString()
                                    : "N/A",

                            status:
                                order.status ||
                                "ORDER RECEIVED",

                            deliveredDate:
                                order.delivered_date
                                    ? new Date(
                                        order.delivered_date
                                    ).toLocaleString()
                                    : "",

                            customer: {

                                name:
                                    order.customer_name ||
                                    "",

                                phone:
                                    order.phone ||
                                    "",

                                email:
                                    order.email ||
                                    "",

                                address:
                                    order.delivery_address ||
                                    "",

                                city:
                                    order.city ||
                                    "",

                                state:
                                    order.state ||
                                    ""

                            },

                            items:
                                Array.isArray(
                                    order.items
                                )
                                    ? order.items
                                    : [],

                            total:
                                Number(
                                    order.total
                                ) || 0

                        };

                    }
                );


            res.json({

                success: true,

                orders:
                    orders

            });


        } catch (error) {

            console.error(
                "ERROR LOADING CUSTOMER ORDERS:",
                error
            );

            res.status(
                500
            ).json({

                success: false,

                message:
                    "Server error while loading your orders."

            });

        }

    }
);

// ================= CART API =================

app.get("/api/cart", async (req, res) => {

    try {

        const auth = await getAuthenticatedCustomer(req);

        if (!auth.success) {
            return res.status(401).json(auth);
        }

        const customerSupabase =
            createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_PUBLISHABLE_KEY,
                {
                    global: {
                        headers: {
                            Authorization:
                                `Bearer ${auth.accessToken}`
                        }
                    }
                }
            );
console.log(
    "CART TOKEN PARTS:",
    auth.accessToken.split(".").length
);
  console.log(
    "CART TOKEN PARTS:",
    auth.accessToken.split(".").length
);   
   const { data, error } =
            await customerSupabase
                .from("cart")
                .select("*")
                .eq(
                    "customer_id",
                    auth.user.id
                );

        if (error) {

            console.error(
                "WISE LUXE CART GET ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        return res.json({
            success: true,
            cart: data || []
        });

    } catch (error) {

        console.error(
            "WISE LUXE CART GET SERVER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

});
app.delete("/api/cart", async (req, res) => {

    try {

        const auth =
            await getAuthenticatedCustomer(req);

        if (!auth.success) {

            return res.status(401).json(auth);

        }


        const customerSupabase =
            createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_PUBLISHABLE_KEY,
                {
                    global: {
                        headers: {
                            Authorization:
                                `Bearer ${auth.accessToken}`
                        }
                    }
                }
            );


        const { error } =
            await customerSupabase
                .from("cart")
                .delete()
                .eq(
                    "customer_id",
                    auth.user.id
                );


        if (error) {

            console.error(
                "WISE LUXE CART DELETE ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }


        return res.json({
            success: true,
            message:
                "Cart cleared successfully."
        });


    } catch (error) {

        console.error(
            "WISE LUXE CART DELETE SERVER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

app.post("/api/cart", async (req, res) => {

    try {

        const auth = await getAuthenticatedCustomer(req);

        if (!auth.success) {
            return res.status(401).json(auth);
        }

        const {
            productId,
            productName,
            productImage,
            size,
            quantity,
            productType,
            productCode,
            price
        } = req.body;

        const customerSupabase =
            createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_PUBLISHABLE_KEY,
                {
                    global: {
                        headers: {
                            Authorization:
                                `Bearer ${auth.accessToken}`
                        }
                    }
                }
            );

        const { data: existingItem, error: findError } =
            await customerSupabase
                .from("cart")
                .select("*")
                .eq(
                    "customer_id",
                    auth.user.id
                )
                .eq(
                    "product_id",
                    Number(productId)
                )
                .eq(
                    "size",
                    size
                )
                .maybeSingle();

        if (findError) {

            console.error(
                "WISE LUXE CART FIND ERROR:",
                findError
            );

            return res.status(500).json({
                success: false,
                message: findError.message
            });

        }

        if (existingItem) {

            const newQuantity =
                Number(existingItem.quantity || 0) +
                Number(quantity || 1);

            const { data, error } =
                await customerSupabase
                    .from("cart")
                    .update({
                        quantity: newQuantity
                    })
                    .eq(
                        "id",
                        existingItem.id
                    )
                    .eq(
                        "customer_id",
                        auth.user.id
                    )
                    .select()
                    .single();

            if (error) {

                console.error(
                    "WISE LUXE CART UPDATE ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });

            }

            console.log(
                "WISE LUXE CART ITEM UPDATED:",
                data
            );

            return res.json({
                success: true,
                cartItem: data
            });

        }

        const { data, error } =
            await customerSupabase
                .from("cart")
                .insert({
                    customer_id:
                        auth.user.id,

                    product_id:
                        Number(productId),

                    product_name:
                        productName,

                    product_image:
                        productImage,

                    size:
                        size,

                    quantity:
                        Number(quantity) || 1,

                    product_type:
                        productType,

                    product_code:
                        productCode,

                    price:
                        Number(price) || 0
                })
                .select()
                .single();

        if (error) {

            console.error(
                "WISE LUXE CART INSERT ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        console.log(
            "WISE LUXE CART ITEM SAVED:",
            data
        );

        return res.json({
            success: true,
            cartItem: data
        });

    } catch (error) {

        console.error(
            "WISE LUXE CART POST SERVER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

});


app.put("/api/cart/:id", async (req, res) => {

    try {

        const auth = await getAuthenticatedCustomer(req);

        if (!auth.success) {
            return res.status(401).json(auth);
        }

        const quantity =
            Number(req.body.quantity);

        const customerSupabase =
            createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_PUBLISHABLE_KEY,
                {
                    global: {
                        headers: {
                            Authorization:
                                `Bearer ${auth.accessToken}`
                        }
                    }
                }
            );

        const { data, error } =
            await customerSupabase
                .from("cart")
                .update({
                    quantity: quantity
                })
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "customer_id",
                    auth.user.id
                )
                .select()
                .single();

        if (error) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        return res.json({
            success: true,
            cartItem: data
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

});


app.delete("/api/cart/:id", async (req, res) => {

    try {

        const auth = await getAuthenticatedCustomer(req);

        if (!auth.success) {
            return res.status(401).json(auth);
        }

        const customerSupabase =
            createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_PUBLISHABLE_KEY,
                {
                    global: {
                        headers: {
                            Authorization:
                                `Bearer ${auth.accessToken}`
                        }
                    }
                }
            );

        const { error } =
            await customerSupabase
                .from("cart")
                .delete()
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "customer_id",
                    auth.user.id
                );

        if (error) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        return res.json({
            success: true
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

});
/* =========================================================
   GET ALL ORDERS
   OWNER ONLY
========================================================= */

app.get(
    "/api/orders",
    ownerAuth,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("orders")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );


            if (error) {

                console.error(
                    "Supabase orders error:",
                    error
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        error.message

                });

            }


            const orders =
                data.map(
                    function(order) {

                        return {

                            orderNumber:
                                order.order_number,

                            date:
                                order.created_at
                                    ? new Date(
                                        order.created_at
                                    ).toLocaleString()
                                    : "N/A",

                            status:
                                order.status ||
                                "ORDER RECEIVED",

                            deliveredDate:
                                order.delivered_date
                                    ? new Date(
                                        order.delivered_date
                                    ).toLocaleString()
                                    : "",

                            customer: {

                                name:
                                    order.customer_name ||
                                    "",

                                phone:
                                    order.phone ||
                                    "",

                                email:
                                    order.email ||
                                    "",

                                address:
                                    order.delivery_address ||
                                    "",

                                city:
                                    order.city ||
                                    "",

                                state:
                                    order.state ||
                                    ""

                            },

                            items:
                                Array.isArray(
                                    order.items
                                )
                                    ? order.items
                                    : [],

                            total:
                                Number(
                                    order.total
                                ) || 0

                        };

                    }
                );


            res.json({

                success: true,

                orders:
                    orders

            });


        } catch (error) {

            console.error(
                "Error loading orders:",
                error
            );

            res.status(
                500
            ).json({

                success: false,

                message:
                    "Could not load orders."

            });

        }

    }
);


/* =========================================================
   UPDATE ORDER
   OWNER ONLY
========================================================= */

app.put(
    "/api/orders/:orderNumber",
    ownerAuth,
    async (
        req,
        res
    ) => {

        try {

            const orderNumber =
                req.params.orderNumber;


            const newStatus =
                req.body.status;


            if (!newStatus) {

                return res.status(
                    400
                ).json({

                    success: false,

                    message:
                        "Order status is required."

                });

            }


            /* -----------------------------------------
               FIND ORDER
            ----------------------------------------- */

            const {
                data: existingOrder,
                error: findError
            } =
                await supabase
                    .from("orders")
                    .select("*")
                    .eq(
                        "order_number",
                        orderNumber
                    )
                    .maybeSingle();


            if (findError) {

                console.error(
                    "Error finding order:",
                    findError
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        findError.message

                });

            }


            if (!existingOrder) {

                return res.status(
                    404
                ).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            /* -----------------------------------------
               UPDATE
            ----------------------------------------- */

            const updateData = {

                status:
                    newStatus

            };


            if (
                newStatus ===
                "DELIVERED"
            ) {

                updateData.delivered_date =
                    new Date()
                        .toISOString();

            }


            const {
                data: updatedOrder,
                error: updateError
            } =
                await supabase
                    .from("orders")
                    .update(
                        updateData
                    )
                    .eq(
                        "order_number",
                        orderNumber
                    )
                    .select()
                    .single();


            if (updateError) {

                console.error(
                    "Error updating order:",
                    updateError
                );

                return res.status(
                    500
                ).json({

                    success: false,

                    message:
                        updateError.message

                });

            }


            /* -----------------------------------------
               FORMAT ORDER
            ----------------------------------------- */

            const order = {

                orderNumber:
                    updatedOrder.order_number,

                date:
                    updatedOrder.created_at
                        ? new Date(
                            updatedOrder.created_at
                        ).toLocaleString()
                        : "N/A",

                status:
                    updatedOrder.status ||
                    "ORDER RECEIVED",

                deliveredDate:
                    updatedOrder.delivered_date
                        ? new Date(
                            updatedOrder.delivered_date
                        ).toLocaleString()
                        : "",

                customer: {

                    name:
                        updatedOrder.customer_name ||
                        "",

                    phone:
                        updatedOrder.phone ||
                        "",

                    email:
                        updatedOrder.email ||
                        "",

                    address:
                        updatedOrder.delivery_address ||
                        "",

                    city:
                        updatedOrder.city ||
                        "",

                    state:
                        updatedOrder.state ||
                        ""

                },

                items:
                    Array.isArray(
                        updatedOrder.items
                    )
                        ? updatedOrder.items
                        : [],

                total:
                    Number(
                        updatedOrder.total
                    ) || 0

            };


            console.log(
                "WISE LUXE ORDER UPDATED:",
                orderNumber,
                newStatus
            );


            res.json({

                success: true,

                message:
                    "Order updated successfully.",

                order:
                    order

            });


        } catch (error) {

            console.error(
                "Error updating order:",
                error
            );

            res.status(
                500
            ).json({

                success: false,

                message:
                    "Could not update order."

            });

        }

    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `WISE LUXE website is running at http://localhost:${PORT}`
        );

        console.log(
            "Order database:",
            ordersFile
        );

    }
);