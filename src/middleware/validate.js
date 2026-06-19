// src/middleware/validate.js
export const validateJobRequest = (req, res, next) => {
  const { title, description, budget, serviceId } = req.body;
  
  if (!title || !description || budget === undefined || !serviceId) {
    return res.status(400).json({ error: "title, description, budget, and serviceId are required" });
  }
  
  if (!Number.isInteger(budget) || budget <= 0) {
    return res.status(400).json({ error: "budget must be a positive integer" });
  }

  if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
    return res.status(400).json({ error: "serviceId must be a valid positive integer" });
  }

  next();
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
