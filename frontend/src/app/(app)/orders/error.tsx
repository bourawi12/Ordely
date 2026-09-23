"use client";

export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <div className="card">
      <h2>Could not load orders</h2>
      <p className="error">
        The backend did not respond. Make sure the NestJS server is running.
      </p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
