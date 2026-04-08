type ConfirmHandler = (message: string, resolve: (value: boolean) => void) => void;

let _handler: ConfirmHandler | null = null;

export function registerConfirmHandler(handler: ConfirmHandler) {
  _handler = handler;
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_handler) {
      resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
      return;
    }
    _handler(message, resolve);
  });
}
