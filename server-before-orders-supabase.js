const express = require("express");
const path = require("path");
const fs = require("fs");

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);
/* ================= FILE LOCATIONS ================= */

const publicFolder = path.join(__dirname, "public");
const ordersFile = path.join(__dirname, "orders.json");


/* ================= MIDDLEWARE ================= */

app.use(express.json());

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
    (req, res) => {

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


            /* GET CURRENT ORDERS */

            const orders =
                getOrders();


            /* PREVENT DUPLICATES */

            const alreadyExists =
                orders.some(
                    function(existingOrder) {

                        return (
                            existingOrder.orderNumber ===
                            order.orderNumber
                        );

                    }
                );


            if (alreadyExists) {

                return res.json({

                    success: true,

                    message:
                        "Order already exists.",

                    order:
                        order

                });

            }


            /* ADD ORDER */

            orders.unshift(order);


            /* SAVE */

            saveOrders(orders);


            console.log(
                "NEW WISE LUXE ORDER:",
                order.orderNumber
            );


            res.json({

                success: true,

                message:
                    "Order saved successfully.",

                order:
                    order

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

app.get(
    "/api/orders",
    (req, res) => {

        try {

            const orders =
                getOrders();


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
    (req, res) => {

        try {

            const orderNumber =
                req.params.orderNumber;


            const orders =
                getOrders();


            const order =
                orders.find(
                    function(item) {

                        return (
                            item.orderNumber ===
                            orderNumber
                        );

                    }
                );


            if (!order) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }


            /* UPDATE STATUS */

            if (req.body.status) {

                order.status =
                    req.body.status;

            }


            /* DELIVERY DATE */

            if (
                req.body.status ===
                "DELIVERED"
            ) {

                order.deliveredDate =
                    new Date().toLocaleString();

            }


            /* SAVE */

            saveOrders(orders);


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