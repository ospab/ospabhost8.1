import ErrorPage from '../components/ErrorPage';

export default function BadGateway() {
  return (
    <ErrorPage
      code="502"
      title="Неверный шлюз"
      description="Сервер получил недействительный ответ от вышестоящего сервера. Это временная проблема, попробуйте обновить страницу."
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      }
      color="orange"
      showLoginButton={false}
      showBackButton={true}
      showHomeButton={true}
    />
  );
}
