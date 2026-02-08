const Column = require("../models/Column");
const Task = require("../models/Task");

exports.getColumns = async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const columns = await Column.find({ projectId }).sort({ order: 1 });
    res.json(columns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createColumn = async (req, res) => {
  try {
    const { projectId, name } = req.body;
    
    // Find max order
    const lastCol = await Column.findOne({ projectId }).sort({ order: -1 });
    const order = lastCol ? lastCol.order + 1 : 0;

    const column = new Column({
      projectId,
      name,
      order
    });

    await column.save();
    res.status(201).json(column);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateColumn = async (req, res) => {
  try {
    const { id } = req.params;
    const column = await Column.findByIdAndUpdate(id, req.body, { new: true });
    res.json(column);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteColumn = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if column has tasks? For now, we allow deletion and tasks become orphaned or we delete them
    // Let's protect it
    const hasTasks = await Task.exists({ columnId: id });
    if (hasTasks) {
        return res.status(400).json({ message: "Cannot delete column containing tasks" });
    }

    await Column.findByIdAndDelete(id);
    res.json({ message: "Column deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
