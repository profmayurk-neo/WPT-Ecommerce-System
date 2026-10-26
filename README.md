# WPT Web Assignment 5 — E-commerce Inventory and Order Processing

This is a beginner-friendly Node.js + JSON solution based on WPT concepts covered so far: JavaScript arrays/functions, JSON, Node.js modules, async file I/O, `async/await`, `try/catch`, and ESLint.

## Run

1. Extract the ZIP.
2. Open a terminal in this project folder.
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Follow the numbered menu.

Run ESLint:

```bash
npm run lint
```

## Files

- `data/products.json`: product inventory
- `data/orders.json`: orders
- `src/app.js`: menu, inventory logic, order processing, validation, and file handling
- `package.json`: ES module setup and commands
- `eslint.config.js`: ESLint configuration

## Features

1. Display products
2. Search product by ID
3. Filter by category
4. Sort by price
5. Add product with validation and duplicate-ID prevention
6. Update product price/stock
7. Delete a product unless it belongs to a placed order
8. Place order and calculate total
9. Display orders
10. Cancel a placed order and restore inventory

## Order flow

- Customer enters a name and one or more product IDs with quantities.
- The program validates product availability and quantities before changing inventory.
- Total = sum of `unitPrice * quantity`.
- Stock is reduced after the order is validated.
- Order and product data are saved as JSON.

## Important learning notes

- This is a local learning application, not a production commerce system.
- Data is stored in JSON files; there is no database, authentication, payment gateway, or web UI in this version.
- The provided assignment summary mentions inventory/order processing but does not expose a detailed rubric. This implementation uses a reasonable basic feature set consistent with the current WPT notes.
- For a production system, product/order updates should be transactional; JSON files do not provide database-level transaction guarantees.
