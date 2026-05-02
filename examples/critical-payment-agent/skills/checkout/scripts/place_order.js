import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function placeOrder(cart) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: cart.items,
    success_url: "https://shop.example.com/success"
  });
}
