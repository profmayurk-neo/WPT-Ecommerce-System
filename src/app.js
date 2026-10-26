import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const productsFile = resolve(currentDirectory, "../data/products.json");
const ordersFile = resolve(currentDirectory, "../data/orders.json");

async function readJsonFile(filePath, label) {
  try {
    const text = await readFile(filePath, "utf8");
    const value = JSON.parse(text);
    if (!Array.isArray(value)) {
      throw new Error(`${label} JSON root must be an array.`);
    }
    return value;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`${label} file not found: ${filePath}`);
    } else if (error instanceof SyntaxError) {
      console.error(`${label} file contains invalid JSON: ${error.message}`);
    } else {
      console.error(`Unable to read ${label}: ${error.message}`);
    }
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadProducts() {
  return readJsonFile(productsFile, "Products");
}

async function loadOrders() {
  return readJsonFile(ordersFile, "Orders");
}

async function saveProducts(products) {
  await writeJsonFile(productsFile, products);
}

async function saveOrders(orders) {
  await writeJsonFile(ordersFile, orders);
}

function displayProducts(products) {
  if (products.length === 0) {
    console.log("No products found.");
    return;
  }
  for (const product of products) {
    console.log(
      `${product.id} | ${product.name} | ${product.category} | ` +
        `Price: ₹${product.price.toFixed(2)} | Stock: ${product.stock} | ` +
        `${product.active ? "Active" : "Inactive"}`,
    );
  }
}

function searchProduct(products, id) {
  return products.find(
    (product) => product.id.toLowerCase() === id.toLowerCase(),
  );
}

function filterProductsByCategory(products, category) {
  return products.filter(
    (product) => product.category.toLowerCase() === category.toLowerCase(),
  );
}

function sortProductsByPrice(products) {
  return [...products].sort((a, b) => a.price - b.price);
}

function validateProduct(product) {
  const errors = [];
  if (!product.id || typeof product.id !== "string") {
    errors.push("Product ID is required.");
  }
  if (!product.name || typeof product.name !== "string") {
    errors.push("Product name is required.");
  }
  if (!product.category || typeof product.category !== "string") {
    errors.push("Product category is required.");
  }
  if (!Number.isFinite(product.price) || product.price <= 0) {
    errors.push("Price must be a positive number.");
  }
  if (!Number.isInteger(product.stock) || product.stock < 0) {
    errors.push("Stock must be a non-negative integer.");
  }
  if (typeof product.active !== "boolean") {
    errors.push("Active must be true or false.");
  }
  return errors;
}

async function addProduct(products, product) {
  const errors = validateProduct(product);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  if (searchProduct(products, product.id)) {
    throw new Error(`Product ID "${product.id}" already exists.`);
  }
  products.push(product);
  await saveProducts(products);
}

async function updateProduct(products, id, changes) {
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) {
    throw new Error(`Product "${id}" not found.`);
  }
  const updated = { ...products[index], ...changes, id };
  const errors = validateProduct(updated);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  products[index] = updated;
  await saveProducts(products);
}

async function deleteProduct(products, orders, id) {
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) {
    throw new Error(`Product "${id}" not found.`);
  }
  const usedByOrder = orders.some(
    (order) =>
      order.status === "PLACED" &&
      order.items.some((item) => item.productId === id),
  );
  if (usedByOrder) {
    throw new Error(
      "Cannot delete this product because it belongs to a placed order.",
    );
  }
  const [deleted] = products.splice(index, 1);
  await saveProducts(products);
  return deleted;
}

async function createOrder(products, orders, customerName, requestedItems) {
  if (!customerName.trim()) {
    throw new Error("Customer name is required.");
  }
  if (requestedItems.length === 0) {
    throw new Error("An order must contain at least one item.");
  }

  // Validate every requested item before changing any stock.
  const orderItems = requestedItems.map(({ productId, quantity }) => {
    const product = searchProduct(products, productId);
    if (!product || !product.active) {
      throw new Error(`Product "${productId}" does not exist or is inactive.`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `Quantity for "${productId}" must be a positive integer.`,
      );
    }
    if (product.stock < quantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${product.stock}.`,
      );
    }
    return {
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
    };
  });

  // Prevent requesting the same product twice from bypassing stock validation.
  const quantityByProduct = new Map();
  for (const item of orderItems) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }
  for (const [productId, quantity] of quantityByProduct) {
    const product = searchProduct(products, productId);
    if (product.stock < quantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${product.stock}.`,
      );
    }
  }

  const total = orderItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const order = {
    id: `O${Date.now()}`,
    customerName: customerName.trim(),
    items: orderItems,
    total,
    status: "PLACED",
    createdAt: new Date().toISOString(),
  };

  for (const [productId, quantity] of quantityByProduct) {
    searchProduct(products, productId).stock -= quantity;
  }
  orders.push(order);

  // Persist both data files after the validated operation.
  await saveProducts(products);
  await saveOrders(orders);
  return order;
}

async function cancelOrder(products, orders, orderId) {
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error(`Order "${orderId}" not found.`);
  }
  if (order.status !== "PLACED") {
    throw new Error("Only placed orders can be cancelled.");
  }

  for (const item of order.items) {
    const product = searchProduct(products, item.productId);
    if (product) {
      product.stock += item.quantity;
    }
  }
  order.status = "CANCELLED";
  await saveProducts(products);
  await saveOrders(orders);
  return order;
}

function displayOrders(orders) {
  if (orders.length === 0) {
    console.log("No orders found.");
    return;
  }
  for (const order of orders) {
    const summary = order.items
      .map((item) => `${item.productName} x ${item.quantity}`)
      .join(", ");
    console.log(
      `${order.id} | ${order.customerName} | ${summary} | ` +
        `Total: ₹${order.total.toFixed(2)} | Status: ${order.status}`,
    );
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    const products = await loadProducts();
    const orders = await loadOrders();

    while (true) {
      console.log(`
=== E-commerce Inventory & Order Processing ===
1. Display all products
2. Search product by ID
3. Filter products by category
4. Sort products by price (low to high)
5. Add product
6. Update product price or stock
7. Delete product
8. Place order
9. Display all orders
10. Cancel order (restocks items)
0. Exit`);

      const choice = (await rl.question("Choose an option: ")).trim();

      try {
        if (choice === "1") {
          displayProducts(products);
        } else if (choice === "2") {
          const id = (await rl.question("Product ID: ")).trim();
          const product = searchProduct(products, id);
          displayProducts(product ? [product] : []);
        } else if (choice === "3") {
          const category = (await rl.question("Category: ")).trim();
          displayProducts(filterProductsByCategory(products, category));
        } else if (choice === "4") {
          displayProducts(sortProductsByPrice(products));
        } else if (choice === "5") {
          const product = {
            id: (await rl.question("Product ID: ")).trim(),
            name: (await rl.question("Product name: ")).trim(),
            category: (await rl.question("Category: ")).trim(),
            price: Number(await rl.question("Price: ")),
            stock: Number(await rl.question("Stock quantity: ")),
            active:
              (await rl.question("Active? (yes/no): ")).trim().toLowerCase() ===
              "yes",
          };
          await addProduct(products, product);
          console.log("Product added and saved.");
        } else if (choice === "6") {
          const id = (await rl.question("Product ID: ")).trim();
          const product = searchProduct(products, id);
          if (!product) {
            console.log("Product not found.");
            continue;
          }
          const priceText = (
            await rl.question("New price (Enter to keep current): ")
          ).trim();
          const stockText = (
            await rl.question("New stock (Enter to keep current): ")
          ).trim();
          const changes = {};
          if (priceText !== "") {
            changes.price = Number(priceText);
          }
          if (stockText !== "") {
            changes.stock = Number(stockText);
          }
          await updateProduct(products, id, changes);
          console.log("Product updated and saved.");
        } else if (choice === "7") {
          const id = (await rl.question("Product ID to delete: ")).trim();
          const deleted = await deleteProduct(products, orders, id);
          console.log(`Deleted ${deleted.name}.`);
        } else if (choice === "8") {
          const customerName = await rl.question("Customer name: ");
          const requestedItems = [];
          while (true) {
            const productId = (
              await rl.question("Product ID (blank to finish): ")
            ).trim();
            if (!productId) {
              break;
            }
            const quantity = Number(await rl.question("Quantity: "));
            requestedItems.push({ productId, quantity });
          }
          const order = await createOrder(
            products,
            orders,
            customerName,
            requestedItems,
          );
          console.log(
            `Order placed: ${order.id}; total = ₹${order.total.toFixed(2)}.`,
          );
        } else if (choice === "9") {
          displayOrders(orders);
        } else if (choice === "10") {
          const orderId = (await rl.question("Order ID to cancel: ")).trim();
          const order = await cancelOrder(products, orders, orderId);
          console.log(`Order ${order.id} cancelled; stock restored.`);
        } else if (choice === "0") {
          console.log("Goodbye.");
          break;
        } else {
          console.log("Invalid choice. Enter 0-10.");
        }
      } catch (error) {
        console.error("Operation failed:", error.message);
      }
    }
  } catch {
    console.error(
      "Application stopped because required JSON data could not be loaded.",
    );
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
