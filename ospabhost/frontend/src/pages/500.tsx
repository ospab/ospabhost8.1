import ErrorPage from '../components/ErrorPage';

export default function ServerError() {
  return (
    <ErrorPage
      code="500"
      title="Ошибка сервера"
      description="На сервере произошла ошибка. Мы уже работаем над её устранением. Попробуйте обновить страницу или вернитесь позже."
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      color="red"
      showLoginButton={false}
      showBackButton={true}
      showHomeButton={true}
    />
  );
}
