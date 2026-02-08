const express = require("express");
const router = express.Router();
const columnController = require("../controllers/columnController");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, columnController.getColumns);
router.post("/", authenticate, columnController.createColumn);
router.put("/:id", authenticate, columnController.updateColumn);
router.delete("/:id", authenticate, columnController.deleteColumn);

module.exports = router;
