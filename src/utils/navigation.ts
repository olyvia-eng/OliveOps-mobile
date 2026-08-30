import { router, type Href } from 'expo-router';

const pendingReturns = new Set<string>();

export function returnToParentOrReplace(parentRoute: Href) {
  const key = typeof parentRoute === 'string' ? parentRoute : JSON.stringify(parentRoute);
  if (pendingReturns.has(key)) return;

  pendingReturns.add(key);
  router.dismissTo(parentRoute);
  queueMicrotask(() => pendingReturns.delete(key));
}

export function returnToParentThenPush(parentRoute: Href, destinationRoute: Href) {
  const key = `${typeof parentRoute === 'string' ? parentRoute : JSON.stringify(parentRoute)}->${typeof destinationRoute === 'string' ? destinationRoute : JSON.stringify(destinationRoute)}`;
  if (pendingReturns.has(key)) return;

  pendingReturns.add(key);
  router.dismissTo(parentRoute);
  router.push(destinationRoute);
  queueMicrotask(() => pendingReturns.delete(key));
}