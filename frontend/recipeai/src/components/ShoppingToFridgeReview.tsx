import React from "react";
import FridgeOperationReview, {
  type FridgeOperationReviewChange,
} from "./FridgeOperationReview";

interface ShoppingToFridgeReviewProps {
  items: FridgeOperationReviewChange[];
  onChange: (change: FridgeOperationReviewChange) => void;
}

const ShoppingToFridgeReview: React.FC<ShoppingToFridgeReviewProps> = ({ items, onChange }) => (
  <FridgeOperationReview changes={items} onChange={onChange} />
);

export default ShoppingToFridgeReview;
