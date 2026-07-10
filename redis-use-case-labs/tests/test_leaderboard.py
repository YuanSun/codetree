import threading


def test_zincrby_is_atomic_no_lost_updates(leaderboard_lab):
    board = leaderboard_lab.BOARD_KEY
    leaderboard_lab.r.delete(board)
    leaderboard_lab.r.zadd(board, {"p1": 0})

    def worker():
        for _ in range(50):
            leaderboard_lab.r.zincrby(board, 1, "p1")

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert leaderboard_lab.r.zscore(board, "p1") == 400.0  # 8 threads * 50 increments

    leaderboard_lab.r.delete(board)


def test_naive_get_then_set_loses_updates(leaderboard_lab):
    board = leaderboard_lab.BOARD_KEY
    leaderboard_lab.r.delete(board)
    leaderboard_lab.r.zadd(board, {"p1": 0})

    def worker():
        for _ in range(50):
            current = leaderboard_lab.r.zscore(board, "p1")
            leaderboard_lab.r.zadd(board, {"p1": current + 1})

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert leaderboard_lab.r.zscore(board, "p1") < 400.0  # the bug: lost updates

    leaderboard_lab.r.delete(board)


def test_rank_and_top_n(leaderboard_lab):
    board = leaderboard_lab.BOARD_KEY
    leaderboard_lab.r.delete(board)
    leaderboard_lab.r.zadd(board, {"Yuan": 1500, "Alex": 800, "Sam": 2200})

    assert leaderboard_lab.r.zrevrange(board, 0, 0) == ["Sam"]
    assert leaderboard_lab.r.zrevrank(board, "Yuan") == 1  # second place, 0-indexed

    leaderboard_lab.r.delete(board)
