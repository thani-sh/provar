import index from "./src/index.html";

const users: any[] = [];
const orders: any[] = [];

const server = Bun.serve({
  port: 6002,
  routes: {
    "/": index,
    "/api/products": {
      async GET() {
        return Response.json([
          { id: 1, name: "Organic Honeycrisp Apples", price: 4.99, description: "Crisp, sweet, and locally grown organic apples. Perfect for a healthy snack." },
          { id: 2, name: "Fair Trade Bananas", price: 1.29, description: "Premium Cavendish bananas from sustainable farms. Sold by the bunch." },
          { id: 3, name: "Wild Blueberries", price: 6.50, description: "Antioxidant-rich wild blueberries. Freshly picked and packed with flavor." },
          { id: 4, name: "Hass Avocados", price: 2.50, description: "Creamy, ripe avocados. Ideal for toast, salads, or homemade guacamole." },
          { id: 5, name: "Golden Pineapples", price: 5.99, description: "Sweet and juicy tropical pineapples. A refreshing treat for any time of day." },
          { id: 6, name: "Ruby Red Strawberries", price: 3.99, description: "Plump, sweet strawberries. Perfect for desserts or eating straight from the box." }
        ]);
      }
    },
    "/api/register": {
      async POST(req) {
        const user = await req.json();
        users.push(user);
        return Response.json({ success: true });
      }
    },
    "/api/login": {
      async POST(req) {
        const { email, password } = await req.json();
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
          // Don't send the password back
          const { password: _, ...userWithoutPassword } = user;
          return Response.json({ success: true, user: userWithoutPassword });
        }
        return Response.json({ success: false, message: "Invalid credentials" }, { status: 401 });
      }
    },
    "/api/orders": {
      async GET() {
        return Response.json(orders);
      }
    },
    "/api/checkout": {
      async POST(req) {
        const body = await req.json();
        const order = {
          ...body,
          id: "PROVAR-" + Math.random().toString(36).substring(7).toUpperCase(),
          date: new Date().toISOString()
        };
        orders.push(order);
        console.log("Processing checkout for:", body);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return Response.json({ success: true, orderId: order.id });
      }
    }
  },
  development: true
});

console.log(`Server running at ${server.url}`);
