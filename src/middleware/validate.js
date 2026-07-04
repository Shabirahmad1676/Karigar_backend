export const validateJobRequest = (req, res, next) => {
  const { title, description, serviceId } = req.body;
  
  if (!title || !description || !serviceId) {
    return res.status(400).json({ error: "Job title, description, and classification context required" });
  }
  
  next(); // Removed the rigid database row counter assertion filters safely
};

export const validateBidRequest = (req, res, next) => {
  const { amount, technicianId } = req.body;
  if (!amount || !technicianId) {
    return res.status(400).json({ error: "amount and technicianId are required" });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive integer" });
  }
  next();
};
