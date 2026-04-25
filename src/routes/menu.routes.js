import { Router } from "express";
import { getPublicMenu, getPublicMenuItem, getPublicCategories } from "../controllers/menu.controller.js";

const router = Router();

router.get("/", getPublicMenu);
router.get("/categories", getPublicCategories);
router.get("/:slug", getPublicMenuItem);

export default router;
