import Stripe from "stripe";
import { requiredEnv } from "@/lib/env";

export const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
