import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/erp/products", async (req, res, next) => {
  try {
    const products = await prisma.erpProduct.findMany({ where: { active: true } });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

export default router;
