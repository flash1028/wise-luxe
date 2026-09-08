const express = require("express");
const path = require("path");
const fs = require("fs");
const basicAuth = require("express-basic-auth");

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);
/* ================= FILE LOCATIONS ================= */

const publicFolder = path.join(__dirname, "public");
const ordersFile = path.join(__dirname, "orders.json");


/* ================= MIDDLEWARE ================= */

app.use(express.json());
app.use(
    "/owner-dashboard.html",
    basicAuth({
        users: {
            owner: process.env.OWNER_PASSWORD
        },
        challenge: true
    })
);
app.use(express.static(publicFolder));


/* ================= CREATE ORDERS FILE ================= */

function makeOrdersFile() {

    if (!fs.existsSync(ordersFile)) {

        fs.writeFileSync(
            ordersFile,
            JSON.stringify([], null, 2)
        );

    }

}

makeOrdersFile();


/* ================= READ ORDERS ================= */

function getOrders() {

    try {

        const data =
            fs.readFileSync(
                ordersFile,
                "utf8"
            );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Could not read orders:",
            error
        );

        return [];

    }

}


/* ================= SAVE ORDERS ================= */

function saveOrders(orders) {

    fs.writeFileSync(
        ordersFile,
        JSON.stringify(
            orders,
            null,
            2
        )
    );

}
/* ================= GET PRODUCTS FROM SUPABASE ================= */

app.get(
    "/api/products",
    async (req, res) => {

        try {

            const { data, error } =
                await supabase
                    .from("products")
                    .select("*")
                    .order("id", { ascending: true });


            if (error) {

                console.error(
                    "Supabase products error:",
                    error
                );

                return res.status(500).json({

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


            res.status(500).json({

                success: false,

                message:
                    "Server error while loading products."

            });

        }

    }
);

/* ================= RECEIVE NEW ORDER ================= */

app.post(
    "/api/orders",
    async (req, res) => {

        try {

            const order =
                req.body;


            /* CHECK ORDER */

            if (!order) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No order data received."

                });

            }


            if (!order.orderNumber) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Order number is required."

                });

            }


            /* CHECK IF ORDER ALREADY EXISTS */

            const { data: existingOrder, error: checkError } =
                await supabase
                    .from("orders")
                    .select("id, order_number")
                    .eq("order_number", order.orderNumber)
                    .maybeSingle();


            if (checkError) {

                console.error(
                    "Error checking existing order:",
                    checkError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to check existing orders."

                });

            }


            if (existingOrder) {

                return res.json({

                    success: true,

                    message:
                        "Order already exists.",

                    order:
                        order

                });

            }


            /* SAVE ORDER TO SUPABASE */

            const { data, error } =
                await supabase
                    .from("orders")
                    .insert({

                        order_number:
                            order.orderNumber,

                       customer_name:
    order.customer?.name || "",

phone:
    order.customer?.phone || "",

email:
    order.customer?.email || "",

delivery_address:
    order.customer?.address || "",

city:
    order.customer?.city || "",

state:
    order.customer?.state || "",

                        items:
                            order.items || [],

                        total:
                            Number(order.total) || 0,

                        payment_method:
                            order.paymentMethod || "",

                        status:
                            order.status || "Pending",

                        delivered_date:
                            order.deliveredDate || null

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Supabase order error:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        error.message

                });

            }


            console.log(
                "NEW WISE LUXE ORDER SAVED TO SUPABASE:",
                order.orderNumber
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


            res.status(500).json({

                success: false,

                message:
                    "Server error while saving order."

            });

        }

    }
);
/* ================= GET ALL ORDERS ================= */
const ownerAuth = basicAuth({
    users: {
        owner: process.env.OWNER_PASSWORD
    },
    challenge: true
});
app.get(
    "/api/orders",
    ownerAuth,
    async (req, res) => {

        try {

            const { data, error } =
                await supabase
                    .from("orders")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    });

            if (error) {

                console.error(
                    "Supabase orders error:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        error.message

                });

            }

            const orders =
                data.map(function(order) {

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
                            Array.isArray(order.items)
                                ? order.items
                                : [],

                        total:
                            Number(order.total) || 0

                    };

                });

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

            res.status(500).json({

                success: false,

                message:
                    "Could not load orders."

            });

        }

    }
);
/* ================= UPDATE ORDER ================= */

app.put(
    "/api/orders/:orderNumber",
    ownerAuth,
    async (req, res) => {

        try {

            const orderNumber =
                req.params.orderNumber;

            const newStatus =
                req.body.status;

            if (!newStatus) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Order status is required."

                });

            }

            /* FIND ORDER IN SUPABASE */

            const { data: existingOrder, error: findError } =
                await supabase
                    .from("orders")
                    .select("*")
                    .eq("order_number", orderNumber)
                    .maybeSingle();

            if (findError) {

                console.error(
                    "Error finding order:",
                    findError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        findError.message

                });

            }

            if (!existingOrder) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }

            /* UPDATE ORDER */

            const updateData = {

                status:
                    newStatus

            };

            if (newStatus === "DELIVERED") {

                updateData.delivered_date =
                    new Date().toISOString();

            }

            const { data: updatedOrder, error: updateError } =
                await supabase
                    .from("orders")
                    .update(updateData)
                    .eq("order_number", orderNumber)
                    .select()
                    .single();

            if (updateError) {

                console.error(
                    "Error updating order:",
                    updateError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        updateError.message

                });

            }

            /* RETURN ORDER IN DASHBOARD FORMAT */

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
                    Array.isArray(updatedOrder.items)
                        ? updatedOrder.items
                        : [],

                total:
                    Number(updatedOrder.total) || 0

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

            res.status(500).json({

                success: false,

                message:
                    "Could not update order."

            });

        }

    }
);

/* ================= START SERVER ================= */

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