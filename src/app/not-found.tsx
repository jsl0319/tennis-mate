import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          찾는 화면이 없어요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          주소가 바뀌었거나 사용할 수 없는 화면이에요.
        </p>
        <Link
          className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-5 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          href="/"
        >
          처음으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
