export interface Order {
  publicId: string;
  customerId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'delivered';
  total: number;
  createdAt: string;
}

export interface CreateOrderInput {
  customerId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
}
