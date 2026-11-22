"""Scaler dengan pembobotan blok untuk fitur gabungan.

Setelah StandardScaler semua kolom bervarian 1, sehingga HOG (1296 kolom) mendominasi jarak/kernel dibanding
GLCM (4 kolom). weighting="equal" membagi tiap blok dengan sqrt(jumlah kolom blok) sehingga setiap blok
(warna, HOG, GLCM) berkontribusi sama pada total varians. Mean/std dan bobot hanya dihitung dari data TRAIN.
"""
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import StandardScaler


class BlockScaler(BaseEstimator, TransformerMixin):
    def __init__(self, block_dims=None, weighting="none"):
        self.block_dims, self.weighting = block_dims, weighting

    def fit(self, X, y=None):
        X = np.asarray(X, dtype=np.float64)
        dims = list(self.block_dims) if self.block_dims else [X.shape[1]]
        if sum(dims) != X.shape[1]:
            raise ValueError("block_dims tidak sesuai jumlah kolom.")
        self.scaler_ = StandardScaler().fit(X)
        w = np.ones(X.shape[1]); i = 0
        for n in dims:
            if self.weighting == "equal":
                w[i:i + n] = 1.0 / np.sqrt(n)
            i += n
        self.weights_ = w
        return self

    def transform(self, X):
        return self.scaler_.transform(np.asarray(X, dtype=np.float64)) * self.weights_

    @property
    def mean_(self):
        return self.scaler_.mean_
